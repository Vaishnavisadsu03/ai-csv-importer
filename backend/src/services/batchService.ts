import { config } from "../config";
import { logger } from "../utils/logger";
import { sleep } from "../utils/sleep";
import { chunkArray } from "../utils/chunkArray";
import { mapRowsWithAi, isRateLimitError, isTokenSizeError } from "./aiService";
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
 * Extracts the Retry-After seconds from a 429 error message if present.
 * OpenAI errors look like: "429 ... Please retry after 20s"
 */
function parseRetryAfterMs(errorMessage: string): number | null {
  const match = errorMessage.match(/retry after (\d+(\.\d+)?)\s*s/i);
  if (match && match[1]) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500; // add 500ms buffer
  }
  // Some responses say "Please try again in 20s"
  const match2 = errorMessage.match(/try again in (\d+(\.\d+)?)\s*s/i);
  if (match2 && match2[1]) {
    return Math.ceil(parseFloat(match2[1]) * 1000) + 500;
  }
  return null;
}

function isRateLimitError(errorMessage: string): boolean {
  return errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit") || errorMessage.toLowerCase().includes("quota");
}

/**
 * Processes all rows in configurable batches.
 * Respects OpenAI rate limits with per-batch delays and smart 429 back-off.
 */
export async function processBatches(
  rows: RawCsvRow[],
  columns: string[],
  options: BatchProcessOptions = {}
): Promise<BatchResult> {
  const batchSize = options.batchSize ?? config.batch.size;
  const maxRetries = options.maxRetries ?? config.batch.maxRetries;
  const retryDelayMs = options.retryDelayMs ?? config.batch.retryDelayMs;

  // Delay between successful batches — critical for rate limit compliance.
  // Free tier: ~3 RPM → need ~20s between requests minimum.
  // Paid tier (Tier 1): ~500 RPM → 200ms is fine.
  // Default from env, falls back to 2000ms (safe for most tiers).
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

    logger.debug(
      { batchIndex, startRow, endRow, rowCount: batch.length },
      `Processing batch ${batchIndex + 1}/${totalBatches}`
    );

    let retryCount = 0;
    let success = false;

    while (retryCount <= maxRetries && !success) {
      try {
        // ── Delay before every attempt (not just retries) ──────────────────
        // First batch, first attempt: no delay needed.
        // All other cases: respect the configured inter-batch delay.
        if (batchIndex > 0 || retryCount > 0) {
          const waitMs =
            retryCount === 0
              ? delayBetweenBatchesMs
              : retryDelayMs * Math.pow(2, retryCount - 1);

          logger.debug(
            { batchIndex, retryCount, waitMs },
            retryCount === 0
              ? `Waiting ${waitMs}ms before next batch`
              : `Retry back-off: waiting ${waitMs}ms`
          );

          await sleep(waitMs);
        }

        const result = await mapRowsWithAi({ rows: batch, columns });

        // Adjust row indices to be absolute
        const adjustedSkipped: SkippedRow[] = result.skippedRows.map((sr) => ({
          ...sr,
          rowIndex: sr.rowIndex + startRow,
        }));

        allRecords.push(...result.records);
        allSkippedRows.push(...adjustedSkipped);
        success = true;

        logger.info(
          { batchIndex, mapped: result.records.length, skipped: result.skippedRows.length },
          `Batch ${batchIndex + 1}/${totalBatches} complete`
        );

        options.onBatchComplete?.(batchIndex, totalBatches, result.records);

      } catch (err) {
        retryCount++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isRateLimit = isRateLimitError(errorMessage);
        const isTooBig   = isTokenSizeError(errorMessage);

        logger.error(
          { batchIndex, retryCount, maxRetries, isRateLimit, isTooBig, error: errorMessage },
          `Batch ${batchIndex + 1} failed (attempt ${retryCount}/${maxRetries + 1})`
        );

        // Token-size errors will NEVER succeed by retrying — fail fast
        if (isTooBig) {
          logger.warn(
            { batchIndex, batchSize: batch.length },
            "Batch too large for model token limit — skipping without retry. Reduce BATCH_SIZE."
          );
          allErrors.push({ batchIndex, startRow, endRow, error: "Batch too large (token limit)", retryCount: 0 });
          options.onBatchError?.(batchIndex, errorMessage);
          for (let i = 0; i < batch.length; i++) {
            allSkippedRows.push({
              rowIndex: startRow + i,
              reason: "Batch exceeded model token limit",
              originalData: batch[i] ?? {},
            });
          }
          break; // exit the while loop for this batch immediately
        }

        if (retryCount > maxRetries) {
          allErrors.push({ batchIndex, startRow, endRow, error: errorMessage, retryCount: retryCount - 1 });
          options.onBatchError?.(batchIndex, errorMessage);
          for (let i = 0; i < batch.length; i++) {
            allSkippedRows.push({
              rowIndex: startRow + i,
              reason: `Batch failed after ${maxRetries} retries: ${errorMessage.slice(0, 100)}`,
              originalData: batch[i] ?? {},
            });
          }
        } else if (isRateLimit) {
          const waitMs = Math.min(retryDelayMs * Math.pow(2, retryCount) + Math.random() * 1000, 60_000);
          logger.info({ batchIndex, waitMs }, `Rate limited — waiting ${(waitMs / 1000).toFixed(1)}s`);
          await sleep(waitMs);
        }
      }
    }
  }

  logger.info(
    { totalRecords: allRecords.length, totalSkipped: allSkippedRows.length, totalErrors: allErrors.length },
    "Batch processing complete"
  );

  return { records: allRecords, skippedRows: allSkippedRows, errors: allErrors };
}
