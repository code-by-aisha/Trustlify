/**
 * Trustlify Backend — Supabase Client (Server-Side)
 *
 * Uses the service_role / secret key for privileged server-side access.
 * NEVER import this module from frontend code.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

function createSupabaseAdmin(): SupabaseClient {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY are required for server-side Supabase client",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Singleton Supabase admin client (server-side only) */
export const supabaseAdmin = createSupabaseAdmin();
