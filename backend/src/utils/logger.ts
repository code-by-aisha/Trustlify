/**
 * Trustlify Backend — Logger Utility
 *
 * Structured logger with sensitive data redaction.
 * Never logs passwords, tokens, API keys, or private user data.
 */

import { isProduction } from "../config/env.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "supabaseSecretKey",
  "dashscopeApiKey",
]);

function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redact(value);
    }
  }
  return result;
}

function formatMessage(
  level: string,
  message: string,
  context?: unknown,
): string {
  const timestamp = new Date().toISOString();
  const base = { timestamp, level, message };
  const payload =
    context !== undefined ? { ...base, ...redact(context) as Record<string, unknown> } : base;
  return isProduction ? JSON.stringify(payload) : formatPretty(payload);
}

function formatPretty(obj: Record<string, unknown>): string {
  const { timestamp, level, message, ...rest } = obj;
  const prefix = `${timestamp} [${level}]`;
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `${prefix} ${message}${extra}`;
}

export const logger = {
  info(message: string, context?: unknown) {
    console.log(formatMessage("INFO", message, context));
  },
  warn(message: string, context?: unknown) {
    console.warn(formatMessage("WARN", message, context));
  },
  error(message: string, context?: unknown) {
    console.error(formatMessage("ERROR", message, context));
  },
  debug(message: string, context?: unknown) {
    if (!isProduction) {
      console.debug(formatMessage("DEBUG", message, context));
    }
  },
};
