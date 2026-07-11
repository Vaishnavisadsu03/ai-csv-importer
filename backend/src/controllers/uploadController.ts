import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { parseCsvFile } from "../services/csvService";
import { createError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import type { RawCsvRow, UploadResponse } from "../types";

// ─── In-Memory Session Store ──────────────────────────────────────────────────
// For production, replace with Redis or a database.

interface SessionData {
  rows: RawCsvRow[];
  columns: string[];
  fileName: string;
  filePath: string;
  createdAt: Date;
}

const sessionStore = new Map<string, SessionData>();

// Clean up sessions older than 1 hour
const SESSION_TTL_MS = 60 * 60 * 1000;

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
      sessionStore.delete(id);
      logger.debug({ sessionId: id }, "Expired session cleaned up");
    }
  }
}

setInterval(cleanupExpiredSessions, 15 * 60 * 1000); // every 15 min

// ─── Public Helpers ───────────────────────────────────────────────────────────

export function getSession(sessionId: string): SessionData | undefined {
  return sessionStore.get(sessionId);
}

// ─── Controller ───────────────────────────────────────────────────────────────

export async function uploadController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw createError("No CSV file uploaded. Send a file in the 'file' field.", 400);
    }

    const { path: filePath, originalname: fileName } = req.file;

    logger.info({ fileName, filePath }, "CSV file received");

    const parsed = await parseCsvFile(filePath, fileName);

    const sessionId = uuidv4();

    sessionStore.set(sessionId, {
      rows: parsed.rows,
      columns: parsed.columns,
      fileName: parsed.fileName,
      filePath: parsed.filePath,
      createdAt: new Date(),
    });

    // Return first 100 rows as preview
    const previewRows = parsed.rows.slice(0, 100);

    const response: UploadResponse = {
      success: true,
      message: "CSV uploaded and parsed successfully",
      data: {
        sessionId,
        fileName: parsed.fileName,
        totalRows: parsed.totalRows,
        columns: parsed.columns,
        preview: previewRows,
      },
    };

    logger.info(
      { sessionId, totalRows: parsed.totalRows, columns: parsed.columns.length },
      "Upload session created"
    );

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
