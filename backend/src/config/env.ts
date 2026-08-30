/**
 * Trustlify Backend — Environment Configuration
 *
 * Validates and exports all required environment variables.
 * Fails fast at startup if critical configuration is missing.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),

  // Supabase — required for Phase 2
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Model Studio — optional (legacy plan)
  DASHSCOPE_API_KEY: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),
  MODEL_STUDIO_BASE_URL: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  MODEL_STUDIO_PRIMARY_MODEL: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),
  MODEL_STUDIO_FAST_MODEL: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),

  // Gemini — Phase 3A (optional at startup; provider fails gracefully when unset)
  GEMINI_API_KEY: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),
  GEMINI_MODEL: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),

  // Tavily — Phase 3B (optional at startup; provider fails gracefully when unset)
  TAVILY_API_KEY: z.string().min(1).optional().or(z.literal("")).transform(v => v || undefined),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      result.error.format(),
    );
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();

export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
