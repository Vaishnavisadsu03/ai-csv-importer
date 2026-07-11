import type { Request, Response, NextFunction } from "express";
import { getSession } from "./uploadController";
import { processBatches } from "../services/batchService";
import { createError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import type { ProcessResponse } from "../types";

export async function processController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = req.body as { sessionId?: string };

    if (!sessionId) {
      throw createError("sessionId is required in the request body", 400);
    }

    const session = getSession(sessionId);
    if (!session) {
      throw createError(
        "Session not found or expired. Please upload the CSV again.",
        404
      );
    }

    logger.info(
      { sessionId, totalRows: session.rows.length },
      "Starting AI processing"
    );

    const startTime = Date.now();

    const result = await processBatches(session.rows, session.columns);

    const processingTimeMs = Date.now() - startTime;

    const response: ProcessResponse = {
      success: true,
      message: `Processing complete. ${result.records.length} records imported.`,
      data: {
        sessionId,
        importedCount: result.records.length,
        skippedCount: result.skippedRows.length,
        errorCount: result.errors.length,
        records: result.records,
        skippedRows: result.skippedRows,
        errors: result.errors,
        processingTimeMs,
      },
    };

    logger.info(
      {
        sessionId,
        importedCount: result.records.length,
        skippedCount: result.skippedRows.length,
        errorCount: result.errors.length,
        processingTimeMs,
      },
      "Processing complete"
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
