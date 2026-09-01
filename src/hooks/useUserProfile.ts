/**
 * Shared user profile state — Supabase-backed with local cache.
 * Fetches from backend API, caches locally, and syncs on updates.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch, ApiError } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface UserProfile {
  id?: string
  userId?: string
  role?: string
  displayName?: string | null
  name: string // alias for displayName
  education: string | null
  /**
   * Structured companion to `education` (profile-structure update). The select
   * in the UI writes both, and the backend re-derives this one from the text
   * whenever only the text changed, so the two can never disagree.
   */
  educationLevel?: string | null
  /** Country name, e.g. "Pakistan" — `location` stays the city/region text. */
  country?: string | null
  /** Discipline studied, e.g. "Computer Science". */
  fieldOfStudy?: string | null
  age?: number | null
  location: string | null
  skills: string[]
  interests: string[]
  experience: string
  portfolioUrl: string | null
  language: string
  timezone: string
  notificationPreferences: Record<string, boolean>
  createdAt?: string
  updatedAt?: string
}

const emptyProfile: UserProfile = {
  name: '',
  displayName: null,
  education: '',
  educationLevel: null,
  country: null,
  fieldOfStudy: null,
  location: '',
  skills: [],
  interests: [],
  experience: '',
  portfolioUrl: null,
  language: 'English',
  timezone: 'Asia/Karachi',
  notificationPreferences: {},
}

const SAVE_FAILED_MESSAGE = 'Profile could not be saved. Please try again.'

/**
 * Hook for consuming the user profile from Supabase.
 * Fetches on mount, updates via API calls.
 *
 * `exists` (row confirmed), `notFound` (row confirmed absent — 404) and
 * `loadError` (the request could not be completed) are deliberately three
 * different states: collapsing them makes a backend outage look like a new
 * user, which throws a returning student into first-time onboarding.
 */
export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfileState] = useState<UserProfile>({ ...emptyProfile })
  const [exists, setExists] = useState(false) // profile row present in Supabase
  const [notFound, setNotFound] = useState(false) // server confirmed no row yet
  const [loadError, setLoadError] = useState<string | null>(null) // request failed
  const [loadedFor, setLoadedFor] = useState<string | null>(null) // user id this state belongs to
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  // Fetch profile on auth change
  useEffect(() => {
    if (!user) {
      setProfileState({ ...emptyProfile })
      setExists(false)
      setNotFound(false)
      setLoadError(null)
      setLoadedFor(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const userId = user.id

    async function fetchProfile() {
      try {
        const res = await apiFetch('/api/profile')
        if (cancelled) return
        const p = res.data
        setProfileState({
          ...emptyProfile,
          ...p,
          name: p.displayName || '',
          portfolioUrl: p.portfolioUrl || null,
        })
        setExists(true)
        setNotFound(false)
        setLoadError(null)
      } catch (err) {
        if (cancelled) return
        // Only a real 404 means "this user has no profile yet". Everything else
        // (backend unreachable, 401, 429, 5xx) is a failed request, not a
        // missing profile — the caller must not treat it as a new user.
        const status = err instanceof ApiError ? err.status : undefined
        const message = err instanceof Error ? err.message : 'Could not load your profile.'
        setProfileState({ ...emptyProfile })
        setExists(false)
        if (status === 404) {
          setNotFound(true)
          setLoadError(null)
        } else {
          setNotFound(false)
          setLoadError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadedFor(userId)
        }
      }
    }

    setLoading(true)
    fetchProfile()

    return () => { cancelled = true }
  }, [user, reloadKey])

  const setProfile = useCallback(async (partial: Partial<UserProfile>): Promise<{ error: string | null }> => {
    // Optimistic local update
    setProfileState(prev => ({ ...prev, ...partial, name: partial.displayName ?? partial.name ?? prev.name }))

    // Map to API fields
    const body: Record<string, unknown> = {}
    if (partial.displayName !== undefined || partial.name !== undefined) {
      body.displayName = partial.displayName ?? partial.name
    }
    if (partial.education !== undefined) body.education = partial.education
    if (partial.educationLevel !== undefined) body.educationLevel = partial.educationLevel
    if (partial.country !== undefined) body.country = partial.country
    if (partial.fieldOfStudy !== undefined) body.fieldOfStudy = partial.fieldOfStudy
    if (partial.age !== undefined) body.age = partial.age
    if (partial.location !== undefined) body.location = partial.location
    if (partial.skills !== undefined) body.skills = partial.skills
    if (partial.interests !== undefined) body.interests = partial.interests
    if (partial.experience !== undefined) body.experience = partial.experience
    if (partial.portfolioUrl !== undefined) body.portfolioUrl = partial.portfolioUrl
    if (partial.language !== undefined) body.language = partial.language
    if (partial.timezone !== undefined) body.timezone = partial.timezone
    if (partial.notificationPreferences !== undefined) {
      body.notificationPreferences = partial.notificationPreferences
    }

    try {
      const res = await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      const p = res.data
      setProfileState({
        ...emptyProfile,
        ...p,
        name: p.displayName || '',
        portfolioUrl: p.portfolioUrl || null,
      })
      setExists(true)
      setNotFound(false)
      setLoadError(null)
      return { error: null }
    } catch (err) {
      const message = saveMessage(err)
      setError(message)
      return { error: message }
    }
  }, [])

  const createProfile = useCallback(async (data: Record<string, unknown>): Promise<{ error: string | null }> => {
    try {
      const res = await apiFetch('/api/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const p = res.data
      setProfileState({
        ...emptyProfile,
        ...p,
        name: p.displayName || '',
        portfolioUrl: p.portfolioUrl || null,
      })
      setExists(true)
      setNotFound(false)
      setLoadError(null)
      return { error: null }
    } catch (err) {
      const message = saveMessage(err)
      setError(message)
      return { error: message }
    }
  }, [])

  return { profile, exists, notFound, loadError, loadedFor, setProfile, createProfile, loading, error, reload }
}

/**
 * Safe user-facing save message. Server validation messages (4xx) are already
 * sanitised and useful; anything at or above 500 is a storage-side failure and
 * keeps its detail in the backend logs only.
 */
function saveMessage(err: unknown): string {
  if (err instanceof ApiError && err.status >= 500) return SAVE_FAILED_MESSAGE
  if (err instanceof ApiError && err.status === 0) return err.message
  return err instanceof Error ? err.message : SAVE_FAILED_MESSAGE
}
