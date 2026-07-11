import fs from "fs";
import Papa from "papaparse";
import { logger } from "../utils/logger";
import { createError } from "../middleware/errorHandler";
import type { RawCsvRow } from "../types/index.js";

export interface ParsedCsv {
  rows: RawCsvRow[];
  columns: string[];
  totalRows: number;
}

export interface CsvPreview extends ParsedCsv {
  fileName: string;
  filePath: string;
}

/**
 * Parses a CSV file from disk and returns rows + column headers.
 * Validates that the file is non-empty and has at least one column.
 */
export async function parseCsvFile(filePath: string, fileName: string): Promise<CsvPreview> {
  if (!fs.existsSync(filePath)) {
    throw createError("Uploaded file not found on server", 500);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  if (!fileContent.trim()) {
    throw createError("The uploaded CSV file is empty", 400);
  }

  const result = Papa.parse<RawCsvRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep everything as strings — AI handles type coercion
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors.length > 0) {
    const criticalErrors = result.errors.filter((e) => e.type === "Delimiter");
    if (criticalErrors.length > 0) {
      logger.warn({ errors: result.errors }, "CSV parse errors encountered");
      throw createError(
        `CSV parsing error: ${criticalErrors[0]?.message ?? "Invalid CSV format"}`,
        400
      );
    }
    // Non-critical errors (field count mismatches, etc.) — log and continue
    logger.warn({ errors: result.errors }, "Non-critical CSV parse warnings");
  }

  const rows = result.data as RawCsvRow[];

  if (rows.length === 0) {
    throw createError("The CSV file contains no data rows", 400);
  }

  const columns = result.meta.fields ?? [];

  if (columns.length === 0) {
    throw createError("The CSV file has no columns", 400);
  }

  // Filter out completely empty rows (all values are blank)
  const nonEmptyRows = rows.filter((row) =>
    Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
  );

  if (nonEmptyRows.length === 0) {
    throw createError("All rows in the CSV are empty", 400);
  }

  logger.info(
    {
      fileName,
      totalRows: nonEmptyRows.length,
      columns: columns.length,
    },
    "CSV parsed successfully"
  );

  return {
    rows: nonEmptyRows,
    columns,
    totalRows: nonEmptyRows.length,
    fileName,
    filePath,
  };
}

/**
 * Deletes a temporary upload file from disk.
 */
export function cleanupUploadedFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug({ filePath }, "Temp upload file deleted");
    }
  } catch (err) {
    logger.warn({ filePath, err }, "Failed to delete temp upload file");
  }
}
