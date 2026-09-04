/**
 * Trustlify Frontend — Startup Environment Check
 *
 * Vite replaces `import.meta.env.VITE_*` with literal strings while
 * `vite build` runs. A variable that exists in the runtime environment but was
 * absent during the build is therefore `undefined` in the shipped JavaScript —
 * the only way to fix it is to rebuild and redeploy.
 */

/** Variables the app cannot start without. */
export const REQUIRED_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const

/** Has a development fallback, so a production build silently inherits it. */
const PRODUCTION_ONLY_ENV = ['VITE_API_BASE_URL'] as const

/** Names of required variables that were not baked into this build. */
export function missingRequiredEnv(): string[] {
  return REQUIRED_ENV.filter((key) => !import.meta.env[key])
}

/**
 * Runs before anything touches Supabase. Returns the missing required names,
 * and warns about optional-but-essential ones so a bad deploy is visible in
 * the console even when the app does start.
 */
export function checkStartupEnv(): string[] {
  if (import.meta.env.PROD) {
    for (const key of PRODUCTION_ONLY_ENV) {
      if (!import.meta.env[key]) {
        console.warn(
          `[trustlify] ${key} was not set at build time — API calls will go to the development default and fail for visitors.`
        )
      }
    }
  }

  return missingRequiredEnv()
}
