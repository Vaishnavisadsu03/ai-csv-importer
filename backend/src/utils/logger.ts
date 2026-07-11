import pino from "pino";
import { config } from "../config";

const isDev = config.nodeEnv === "development";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      })
    : undefined
);

export default logger;
