import Groq from "groq-sdk";
import { config } from "../config";
import { logger } from "../utils/logger";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts/systemPrompt";
import type {
  CrmRecord,
  RawCsvRow,
  AiMappingRequest,
  AiMappingResponse,
  SkippedRow,
} from "../types";

const groq = new Groq({ apiKey: config.openAi.apiKey });

// ─── Models that support response_format: json_object ─────────────────────────
// gpt-oss models use a reasoning format and do NOT support json_object mode.
// Llama / Mixtral / Gemma models on Groq do support it.
const JSON_OBJECT_SUPPORTED_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "gemma-7b-it",
]);

function supportsJsonObjectMode(model: string): boolean {
  return JSON_OBJECT_SUPPORTED_MODELS.has(model.toLowerCase());
}

// ─── Validation Sets ──────────────────────────────────────────────────────────

const VALID_CRM_STATUSES = new Set([
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
]);

const VALID_DATA_SOURCES = new Set([
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
  "Other",
]);

// ─── Error Classifiers ────────────────────────────────────────────────────────

export function isTokenSizeError(msg: string): boolean {
  return (
    msg.includes("413") ||
    msg.toLowerCase().includes("request too large") ||
    msg.toLowerCase().includes("tokens per minute") ||
    (msg.toLowerCase().includes("rate_limit_exceeded") && msg.toLowerCase().includes("token"))
  );
}

export function isRateLimitError(msg: string): boolean {
  return (
    (msg.includes("429") || msg.toLowerCase().includes("rate limit")) &&
    !isTokenSizeError(msg)
  );
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim();

  // Strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Find outermost { ... }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found. Got: ${s.slice(0, 300)}`);
  }

  return s.slice(start, end + 1);
}

// ─── Record Sanitizer ─────────────────────────────────────────────────────────

function sanitizeRecord(raw: Record<string, unknown>): CrmRecord {
  const str = (key: string): string | null => {
    const v = raw[key];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };

  const rawStatus = str("crm_status");
  const rawSource = str("data_source");

  return {
    created_at: str("created_at"),
    name: str("name"),
    email: str("email"),
    country_code: str("country_code"),
    mobile_without_country_code: str("mobile_without_country_code"),
    company: str("company"),
    city: str("city"),
    state: str("state"),
    country: str("country"),
    lead_owner: str("lead_owner"),
    crm_status:
      rawStatus && VALID_CRM_STATUSES.has(rawStatus)
        ? (rawStatus as CrmRecord["crm_status"])
        : null,
    crm_note: str("crm_note"),
    data_source: rawSource
      ? VALID_DATA_SOURCES.has(rawSource) ? rawSource : "Other"
      : null,
    possession_time: str("possession_time"),
    description: str("description"),
  };
}

// ─── Main Mapping Function ────────────────────────────────────────────────────

export async function mapRowsWithAi(
  request: AiMappingRequest
): Promise<AiMappingResponse> {
  const { rows, columns } = request;
  const model = config.openAi.model;
  const useJsonMode = supportsJsonObjectMode(model);

  logger.debug(
    { rowCount: rows.length, model, jsonMode: useJsonMode },
    "Calling Groq AI"
  );

  const startTime = Date.now();

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: config.openAi.maxTokens,
    // Only set response_format for models that support it
    ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(rows, columns) },
    ],
  });

  const elapsed = Date.now() - startTime;
  const rawContent = completion.choices[0]?.message?.content;

  if (!rawContent) throw new Error("Groq returned an empty response");

  logger.debug(
    { elapsed, tokens: completion.usage?.total_tokens, model },
    "Groq response received"
  );

  // ── Parse ─────────────────────────────────────────────────────────────────
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(rawContent)) as Record<string, unknown>;
  } catch (e) {
    logger.error({ raw: rawContent.slice(0, 500) }, "Failed to parse Groq JSON");
    throw new Error(
      `Invalid JSON from Groq: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // ── Extract records ───────────────────────────────────────────────────────
  const rawRecords = parsed["records"];
  if (!Array.isArray(rawRecords)) {
    throw new Error(
      `Groq response missing "records" array. Keys: ${Object.keys(parsed).join(", ")}`
    );
  }

  // ── Extract model-identified skipped rows ─────────────────────────────────
  const modelSkipped = Array.isArray(parsed["skipped"])
    ? (parsed["skipped"] as Array<{ original_row?: RawCsvRow; reason?: string }>)
    : [];

  const records: CrmRecord[] = [];
  const skippedRows: SkippedRow[] = [];

  for (const s of modelSkipped) {
    skippedRows.push({
      rowIndex: -1,
      reason: s?.reason ?? "Skipped by AI",
      originalData: s?.original_row ?? {},
    });
  }

  for (let i = 0; i < rawRecords.length; i++) {
    const rawRecord = rawRecords[i] as Record<string, unknown>;
    const rowIndex =
      typeof rawRecord["_row_index"] === "number" ? rawRecord["_row_index"] : i;
    const record = sanitizeRecord(rawRecord);

    if (!record.email && !record.mobile_without_country_code) {
      skippedRows.push({
        rowIndex,
        reason: "No email or phone number found",
        originalData: rows[rowIndex] ?? rows[i] ?? {},
      });
      continue;
    }

    records.push(record);
  }

  logger.info(
    {
      inputRows: rows.length,
      mapped: records.length,
      skipped: skippedRows.length,
      elapsedMs: elapsed,
      tokensUsed: completion.usage?.total_tokens,
      model,
    },
    "Groq mapping complete"
  );

  return { records, skippedRows };
}
