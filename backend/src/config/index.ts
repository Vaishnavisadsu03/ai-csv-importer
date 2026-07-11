import dotenv from "dotenv";
import path from "path";
import type { AppConfig } from "../types";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

export const config: AppConfig = {
  port: getEnvNumber("PORT", 4000),
  nodeEnv: getEnv("NODE_ENV", "development"),

  // Groq config — stored under the same "openAi" key in AppConfig
  // so nothing else in the codebase needs to change
  openAi: {
    apiKey: requireEnv("GROQ_API_KEY"),
    model: getEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    maxTokens: getEnvNumber("GROQ_MAX_TOKENS", 8192),
    temperature: getEnvFloat("GROQ_TEMPERATURE", 0),
  },

  batch: {
    size: getEnvNumber("BATCH_SIZE", 10),
    maxRetries: getEnvNumber("MAX_RETRIES", 3),
    retryDelayMs: getEnvNumber("RETRY_DELAY_MS", 5000),
  },

  upload: {
    maxFileSizeMb: getEnvNumber("MAX_FILE_SIZE_MB", 10),
    uploadDir: getEnv("UPLOAD_DIR", "uploads"),
  },

  cors: {
    origin: getEnv("CORS_ORIGIN", "http://localhost:3000"),
  },
};

export default config;
