import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;

    const logFn =
      res.statusCode >= 500
        ? logger.error.bind(logger)
        : res.statusCode >= 400
          ? logger.warn.bind(logger)
          : logger.info.bind(logger);

    logFn(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
      `${req.method} ${req.originalUrl} ${res.statusCode} — ${duration}ms`
    );
  });

  next();
}
