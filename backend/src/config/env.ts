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

  // Supabase — required in Phase 2, optional now
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),

  // Model Studio — required in Phase 3, optional now
  DASHSCOPE_API_KEY: z.string().optional(),
  MODEL_STUDIO_BASE_URL: z.string().url().optional(),
  MODEL_STUDIO_PRIMARY_MODEL: z.string().optional(),
  MODEL_STUDIO_FAST_MODEL: z.string().optional(),
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
