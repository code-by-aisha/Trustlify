/// <reference types="vite/client" />

/**
 * Frontend configuration. Every value here is inlined into the build output and
 * is therefore readable by anyone who loads the site - public keys only.
 */
interface ImportMetaEnv {
  /** Supabase project origin, e.g. https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (client) key - never the secret key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Backend API origin without a trailing slash. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
