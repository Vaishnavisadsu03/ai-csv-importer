import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isOperational = err.isOperational ?? false;

  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      statusCode,
      isOperational,
    },
    "Request error"
  );

  res.status(statusCode).json({
    success: false,
    message: err.message ?? "Internal server error",
    ...(process.env["NODE_ENV"] === "development" && {
      stack: err.stack,
    }),
  });
}

/**
 * Creates a typed operational error (client-safe, expected error).
 */
export function createError(message: string, statusCode = 400): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
