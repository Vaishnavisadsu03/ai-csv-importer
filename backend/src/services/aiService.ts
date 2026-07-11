import Groq from "groq-sdk";
import { config } from "../config";
import { logger } from "../utils/logger";
import { SYSTEM_PROMPT, buildUserPrompt, estimateTokens } from "../prompts/systemPrompt";
import type {
  CrmRecord,
  RawCsvRow,
  AiMappingRequest,
  AiMappingResponse,
  SkippedRow,
} from "../types";

const groq = new Groq({ apiKey: config.openAi.apiKey });

// ─── Model Context Windows ────────────────────────────────────────────────────
// Conservative limits — actual context may be larger, but we stay safe.
const MODEL_CONTEXT_TOKENS: Record<string, number> = {
  "llama-3.3-70b-versatile":  128_000,
  "llama-3.1-70b-versatile":  128_000,
  "llama-3.1-8b-instant":     128_000,
  "llama3-70b-8192":            8_192,
  "llama3-8b-8192":             8_192,
  "mixtral-8x7b-32768":        32_768,
  "gemma2-9b-it":               8_192,
  "gemma-7b-it":                8_192,
};

// Reserve this many tokens for the model's output
const OUTPUT_TOKEN_RESERVE = 4_096;

// ─── Models supporting response_format: json_object ──────────────────────────
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

function getContextLimit(model: string): number {
  return MODEL_CONTEXT_TOKENS[model.toLowerCase()] ?? 8_192;
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

// ─── Error Classification ─────────────────────────────────────────────────────

export interface GroqErrorInfo {
  type: "context_exceeded" | "tpm_exceeded" | "rpm_exceeded" | "rate_limit" |
        "invalid_request" | "invalid_json" | "auth_error" | "timeout" | "unknown";
  message: string;
  statusCode?: number;
  requestId?: string;
  retryable: boolean;
}

export function classifyGroqError(err: unknown): GroqErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  // Try to extract structured info from Groq SDK error
  let statusCode: number | undefined;
  let requestId: string | undefined;
  let body = "";

  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e["status"] === "number") statusCode = e["status"];
    if (typeof e["headers"] === "object" && e["headers"] !== null) {
      const h = e["headers"] as Record<string, string>;
      requestId = h["x-request-id"] ?? h["request-id"];
    }
    // Groq SDK wraps the body in error.error or error.body
    if (typeof e["error"] === "object" && e["error"] !== null) {
      body = JSON.stringify(e["error"]);
    } else if (typeof e["body"] === "string") {
      body = e["body"];
    }
  }

  logger.error(
    { statusCode, requestId, rawMessage: raw, body: body.slice(0, 500) },
    "Groq API error details"
  );

  // 401 / 403 — auth
  if (statusCode === 401 || statusCode === 403 || lower.includes("invalid api key") || lower.includes("authentication")) {
    return { type: "auth_error", message: `Authentication failed: ${raw}`, statusCode, requestId, retryable: false };
  }

  // 413 — request too large (actual payload bytes exceeded, not tokens)
  if (statusCode === 413 || lower.includes("payload too large") || lower.includes("request entity too large")) {
    return { type: "context_exceeded", message: `Request payload too large (HTTP 413): reduce batch size. ${raw}`, statusCode, requestId, retryable: false };
  }

  // 400 with context length message — model context window exceeded
  if (
    lower.includes("context_length_exceeded") ||
    lower.includes("context window") ||
    lower.includes("maximum context length") ||
    lower.includes("prompt is too long") ||
    lower.includes("input is too long") ||
    (lower.includes("tokens") && lower.includes("exceed"))
  ) {
    return { type: "context_exceeded", message: `Prompt exceeds model context window: ${raw}`, statusCode, requestId, retryable: false };
  }

  // TPM — tokens per minute rate limit
  if (
    (lower.includes("rate_limit_exceeded") || lower.includes("rate limit")) &&
    (lower.includes("token") || lower.includes("tpm"))
  ) {
    return { type: "tpm_exceeded", message: `Tokens-per-minute rate limit hit: ${raw}`, statusCode, requestId, retryable: true };
  }

  // RPM — requests per minute rate limit
  if (
    (lower.includes("rate_limit_exceeded") || lower.includes("rate limit")) &&
    (lower.includes("request") || lower.includes("rpm"))
  ) {
    return { type: "rpm_exceeded", message: `Requests-per-minute rate limit hit: ${raw}`, statusCode, requestId, retryable: true };
  }

  // Generic 429 — rate limit (TPM or RPM, not specified)
  if (statusCode === 429 || lower.includes("429") || lower.includes("too many requests")) {
    return { type: "rate_limit", message: `Rate limited (429): ${raw}`, statusCode, requestId, retryable: true };
  }

  // 503 / 502 — service unavailable (retryable)
  if (statusCode === 503 || statusCode === 502 || lower.includes("service unavailable") || lower.includes("bad gateway")) {
    return { type: "unknown", message: `Groq service unavailable (${statusCode ?? "5xx"}): ${raw}`, statusCode, requestId, retryable: true };
  }

  // Network timeout
  if (lower.includes("timeout") || lower.includes("econnreset") || lower.includes("econnrefused") || lower.includes("network")) {
    return { type: "timeout", message: `Network timeout or connection error: ${raw}`, statusCode, requestId, retryable: true };
  }

  // 400 — invalid request (non-context, non-retryable)
  if (statusCode === 400 || lower.includes("invalid request") || lower.includes("bad request")) {
    return { type: "invalid_request", message: `Invalid request (400): ${raw}`, statusCode, requestId, retryable: false };
  }

  // JSON parse failure
  if (lower.includes("json") || lower.includes("parse")) {
    return { type: "invalid_json", message: `JSON parse error from Groq response: ${raw}`, statusCode, requestId, retryable: false };
  }

  return { type: "unknown", message: `Unknown Groq error: ${raw}`, statusCode, requestId, retryable: true };
}

// Legacy helpers — kept for batchService compatibility
export function isTokenSizeError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("context_length_exceeded") ||
    lower.includes("context window") ||
    lower.includes("maximum context length") ||
    lower.includes("prompt is too long") ||
    lower.includes("input is too long") ||
    lower.includes("payload too large") ||
    lower.includes("request entity too large") ||
    (lower.includes("413"))
  );
}

export function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit_exceeded") ||
    lower.includes("tokens per minute") ||
    lower.includes("requests per minute") ||
    lower.includes("tpm") ||
    lower.includes("rpm")
  );
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in response. Preview: ${s.slice(0, 300)}`);
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
    crm_status: rawStatus && VALID_CRM_STATUSES.has(rawStatus)
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
  const contextLimit = getContextLimit(model);

  // ── Pre-flight token estimate ─────────────────────────────────────────────
  const userPrompt = buildUserPrompt(rows, columns);
  const promptTokensEst = estimateTokens(SYSTEM_PROMPT) + estimateTokens(userPrompt);
  const maxInputTokens = contextLimit - OUTPUT_TOKEN_RESERVE;

  logger.info(
    {
      model,
      batchRows: rows.length,
      promptChars: SYSTEM_PROMPT.length + userPrompt.length,
      estimatedPromptTokens: promptTokensEst,
      contextLimit,
      maxInputTokens,
      outputReserve: OUTPUT_TOKEN_RESERVE,
      jsonMode: useJsonMode,
    },
    "Pre-flight: Groq request details"
  );

  if (promptTokensEst > maxInputTokens) {
    const msg = `Prompt exceeds context window before sending: ~${promptTokensEst} estimated tokens > ${maxInputTokens} available (model: ${model}, rows: ${rows.length}). Reduce BATCH_SIZE.`;
    logger.error({ promptTokensEst, maxInputTokens, model, rows: rows.length }, msg);
    throw new Error(msg);
  }

  // ── Call Groq ─────────────────────────────────────────────────────────────
  const startTime = Date.now();
  let completion: Awaited<ReturnType<typeof groq.chat.completions.create>>;

  try {
    completion = await groq.chat.completions.create({
      model,
      temperature: config.openAi.temperature,
      max_tokens: Math.min(config.openAi.maxTokens, OUTPUT_TOKEN_RESERVE),
      ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });
  } catch (err) {
    const info = classifyGroqError(err);
    throw new Error(info.message);
  }

  const elapsed = Date.now() - startTime;
  const usage = completion.usage;
  const rawContent = completion.choices[0]?.message?.content;

  logger.info(
    {
      model,
      elapsedMs: elapsed,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
      batchRows: rows.length,
    },
    "Groq response received"
  );

  if (!rawContent) {
    throw new Error("Groq returned an empty response body");
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(rawContent)) as Record<string, unknown>;
  } catch (e) {
    logger.error({ rawPreview: rawContent.slice(0, 500) }, "Failed to parse Groq JSON response");
    throw new Error(`Invalid JSON from Groq: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Extract records + skipped ─────────────────────────────────────────────
  const rawRecords = parsed["records"];
  if (!Array.isArray(rawRecords)) {
    throw new Error(
      `Groq response missing "records" array. Keys found: ${Object.keys(parsed).join(", ")}`
    );
  }

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
    const rowIndex = typeof rawRecord["_row_index"] === "number" ? rawRecord["_row_index"] : i;
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
      model,
      inputRows: rows.length,
      mapped: records.length,
      skipped: skippedRows.length,
      elapsedMs: elapsed,
      totalTokens: usage?.total_tokens,
    },
    "Groq mapping complete"
  );

  return { records, skippedRows };
}
