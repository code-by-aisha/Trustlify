/**
 * Shared user profile state — Supabase-backed with local cache.
 * Fetches from backend API, caches locally, and syncs on updates.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface UserProfile {
  id?: string
  userId?: string
  role?: string
  displayName?: string | null
  name: string // alias for displayName
  education: string | null
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
  location: '',
  skills: [],
  interests: [],
  experience: '',
  portfolioUrl: null,
  language: 'English',
  timezone: 'Asia/Karachi',
  notificationPreferences: {},
}

/**
 * Hook for consuming the user profile from Supabase.
 * Fetches on mount, updates via API calls.
 */
export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfileState] = useState<UserProfile>({ ...emptyProfile })
  const [exists, setExists] = useState(false) // profile row present in Supabase
  const [loadedFor, setLoadedFor] = useState<string | null>(null) // user id this state belongs to
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch profile on auth change
  useEffect(() => {
    if (!user) {
      setProfileState({ ...emptyProfile })
      setExists(false)
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
      } catch {
        // Profile not found yet — that's ok for new users
        if (!cancelled) {
          setProfileState({ ...emptyProfile })
          setExists(false)
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
  }, [user])

  const setProfile = useCallback(async (partial: Partial<UserProfile>): Promise<{ error: string | null }> => {
    // Optimistic local update
    setProfileState(prev => ({ ...prev, ...partial, name: partial.displayName ?? partial.name ?? prev.name }))

    // Map to API fields
    const body: Record<string, unknown> = {}
    if (partial.displayName !== undefined || partial.name !== undefined) {
      body.displayName = partial.displayName ?? partial.name
    }
    if (partial.education !== undefined) body.education = partial.education
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
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
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
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile'
      setError(message)
      return { error: message }
    }
  }, [])

  return { profile, exists, loadedFor, setProfile, createProfile, loading, error }
}
