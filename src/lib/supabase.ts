/**
 * Trustlify Frontend — Supabase Client
 *
 * Client-side Supabase initialization using publishable keys only.
 * The server-side secret key is NEVER exposed here.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY environment variables'
  )
}

/** Singleton Supabase client for the frontend */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

/** Backend API base URL */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

/** Shown when the request never produced an HTTP response (backend down, wrong
 * port, or a blocked cross-origin call). The browser's own text for this is
 * "Failed to fetch", which is meaningless to a user and hides the real cause. */
export const BACKEND_UNREACHABLE_MESSAGE =
  'Unable to reach Trustlify server. Please try again.'

/**
 * Error carrying the HTTP status so callers can tell "this resource does not
 * exist" (404) apart from "the request could not be completed" (0 / 401 / 429 /
 * 5xx). Without this, a transient failure is indistinguishable from a missing
 * profile and silently sends a returning user through first-time onboarding.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Helper to make authenticated API calls to the backend.
 * Throws ApiError: status 0 means no HTTP response was received.
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    // Transport-level failure: nothing answered. Never report this as "not found".
    throw new ApiError(BACKEND_UNREACHABLE_MESSAGE, 0)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: response.statusText } }))
    const serverMessage = body?.error?.message || body?.message
    // 5xx details stay in the server logs — the user gets a safe line.
    const message = response.status >= 500
      ? 'Trustlify could not complete that request. Please try again.'
      : serverMessage || `Request failed (${response.status})`
    throw new ApiError(message, response.status)
  }

  return response.json()
}
