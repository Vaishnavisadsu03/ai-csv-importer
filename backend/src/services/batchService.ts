import { config } from "../config";
import { logger } from "../utils/logger";
import { sleep } from "../utils/sleep";
import { chunkArray } from "../utils/chunkArray";
import { mapRowsWithAi, classifyGroqError } from "./aiService";
import type {
  RawCsvRow,
  CrmRecord,
  BatchResult,
  BatchError,
  SkippedRow,
} from "../types";

export interface BatchProcessOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  delayBetweenBatchesMs?: number;
  onBatchComplete?: (batchIndex: number, totalBatches: number, records: CrmRecord[]) => void;
  onBatchError?: (batchIndex: number, error: string) => void;
}

/**
 * Parses a "retry after N seconds" hint from a Groq rate-limit message.
 */
function parseRetryAfterMs(errorMessage: string): number | null {
  const m =
    errorMessage.match(/retry after (\d+(?:\.\d+)?)\s*s/i) ??
    errorMessage.match(/try again in (\d+(?:\.\d+)?)\s*s/i);
  if (m?.[1]) {
    return Math.ceil(parseFloat(m[1]) * 1000) + 500;
  }
  return null;
}

/**
 * Processes all CSV rows in configurable batches through the AI mapping pipeline.
 * - Only sends the current batch to the AI — never the full CSV.
 * - Retries only on retryable errors (429, 503, network).
 * - Fails fast on non-retryable errors (400, 401, 403, 413, context exceeded).
 */
export async function processBatches(
  rows: RawCsvRow[],
  columns: string[],
  options: BatchProcessOptions = {}
): Promise<BatchResult> {
  const batchSize = options.batchSize ?? config.batch.size;
  const maxRetries = options.maxRetries ?? config.batch.maxRetries;
  const retryDelayMs = options.retryDelayMs ?? config.batch.retryDelayMs;
  const delayBetweenBatchesMs =
    options.delayBetweenBatchesMs ??
    parseInt(process.env["DELAY_BETWEEN_BATCHES_MS"] ?? "2000", 10);

  const batches = chunkArray(rows, batchSize);
  const totalBatches = batches.length;

  logger.info(
    { totalRows: rows.length, batchSize, totalBatches, delayBetweenBatchesMs },
    "Starting batch processing"
  );

  const allRecords: CrmRecord[] = [];
  const allSkippedRows: SkippedRow[] = [];
  const allErrors: BatchError[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;
    const startRow = batchIndex * batchSize;
    const endRow = startRow + batch.length - 1;

    logger.info(
      {
        batchIndex,
        batchNumber: batchIndex + 1,
        totalBatches,
        startRow,
        endRow,
        rowCount: batch.length,
      },
      `Processing batch ${batchIndex + 1}/${totalBatches}`
    );

    let retryCount = 0;
    let success = false;

    while (!success) {
      try {
        // Inter-batch delay (skip for first batch, first attempt)
        if (batchIndex > 0 || retryCount > 0) {
          const waitMs =
            retryCount === 0
              ? delayBetweenBatchesMs
              : Math.min(retryDelayMs * Math.pow(2, retryCount - 1), 60_000);

          logger.debug(
            { batchIndex, retryCount, waitMs },
            retryCount === 0
              ? `Inter-batch delay: ${waitMs}ms`
              : `Retry back-off: ${waitMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`
          );

          await sleep(waitMs);
        }

        // Send ONLY the current batch — never the full rows array
        const result = await mapRowsWithAi({ rows: batch, columns });

        // Adjust row indices to absolute positions in the full CSV
        const adjustedSkipped: SkippedRow[] = result.skippedRows.map((sr) => ({
          ...sr,
          rowIndex: sr.rowIndex >= 0 ? sr.rowIndex + startRow : sr.rowIndex,
        }));

        allRecords.push(...result.records);
        allSkippedRows.push(...adjustedSkipped);
        success = true;

        logger.info(
          {
            batchIndex,
            batchNumber: batchIndex + 1,
            totalBatches,
            mapped: result.records.length,
            skipped: result.skippedRows.length,
          },
          `Batch ${batchIndex + 1}/${totalBatches} complete`
        );

        options.onBatchComplete?.(batchIndex, totalBatches, result.records);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const info = classifyGroqError(err);

        logger.error(
          {
            batchIndex,
            batchNumber: batchIndex + 1,
            retryCount,
            maxRetries,
            errorType: info.type,
            retryable: info.retryable,
            statusCode: info.statusCode,
            requestId: info.requestId,
            error: info.message,
          },
          `Batch ${batchIndex + 1} failed — type: ${info.type}`
        );

        // ── Non-retryable errors — fail this batch immediately ───────────
        if (!info.retryable) {
          const friendlyError = info.type === "context_exceeded"
            ? `Prompt exceeds model context window (reduce BATCH_SIZE). Detail: ${info.message}`
            : info.type === "auth_error"
            ? `Groq authentication failed — check GROQ_API_KEY. Detail: ${info.message}`
            : info.type === "invalid_request"
            ? `Invalid request sent to Groq. Detail: ${info.message}`
            : info.message;

          logger.warn(
            { batchIndex, errorType: info.type },
            `Non-retryable error — skipping batch ${batchIndex + 1} without retry`
          );

          allErrors.push({
            batchIndex,
            startRow,
            endRow,
            error: friendlyError,
            retryCount,
          });

          for (let i = 0; i < batch.length; i++) {
            allSkippedRows.push({
              rowIndex: startRow + i,
              reason: `Batch failed (${info.type}): ${friendlyError.slice(0, 120)}`,
              originalData: batch[i] ?? {},
            });
          }

          options.onBatchError?.(batchIndex, friendlyError);
          break; // exit while loop, move to next batch
        }

        // ── Retryable errors ──────────────────────────────────────────────
        retryCount++;

        if (retryCount > maxRetries) {
          logger.warn(
            { batchIndex, retryCount, maxRetries },
            `Batch ${batchIndex + 1} exhausted all ${maxRetries} retries`
          );

          allErrors.push({
            batchIndex,
            startRow,
            endRow,
            error: `${info.message} (failed after ${maxRetries} retries)`,
            retryCount,
          });

          for (let i = 0; i < batch.length; i++) {
            allSkippedRows.push({
              rowIndex: startRow + i,
              reason: `Batch failed after ${maxRetries} retries: ${errorMessage.slice(0, 100)}`,
              originalData: batch[i] ?? {},
            });
          }

          options.onBatchError?.(batchIndex, errorMessage);
          break;
        }

        // Honour Groq's Retry-After hint if present
        const retryAfterMs = parseRetryAfterMs(errorMessage);
        const backOffMs = retryAfterMs ??
          Math.min(retryDelayMs * Math.pow(2, retryCount) + Math.random() * 1000, 60_000);

        logger.info(
          { batchIndex, retryCount, maxRetries, waitMs: backOffMs, errorType: info.type },
          `Retryable error (${info.type}) — retrying in ${(backOffMs / 1000).toFixed(1)}s`
        );

        await sleep(backOffMs);
      }
    }
  }

  logger.info(
    {
      totalRecords: allRecords.length,
      totalSkipped: allSkippedRows.length,
      totalErrors: allErrors.length,
    },
    "Batch processing complete"
  );

  return { records: allRecords, skippedRows: allSkippedRows, errors: allErrors };
}
