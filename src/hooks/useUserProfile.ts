/**
 * Shared user profile state — module-level singleton with subscriber pattern.
 * Replaces hard-coded names across Dashboard, Onboarding, and Settings.
 * Architecture: trivially replaceable by a Supabase/backend call later.
 */

import { useSyncExternalStore, useCallback } from 'react'

export interface UserProfile {
  name: string
  education: string
  location: string
  skills: string[]
  interests: string[]
  experience: string
  portfolioUrl: string
}

const defaultProfile: UserProfile = {
  name: 'Aisha',
  education: '',
  location: '',
  skills: [],
  interests: [],
  experience: '',
  portfolioUrl: '',
}

/* ─── Module-level singleton state ───────────────────────────────────────── */

let profile: UserProfile = { ...defaultProfile }
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): UserProfile {
  return profile
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

export function setProfile(partial: Partial<UserProfile>) {
  profile = { ...profile, ...partial }
  notify()
}

export function resetProfile() {
  profile = { ...defaultProfile }
  notify()
}

/**
 * Hook for consuming the shared user profile.
 * Uses useSyncExternalStore for tear-free reads in React 18+/19.
 */
export function useUserProfile() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const update = useCallback((partial: Partial<UserProfile>) => {
    setProfile(partial)
  }, [])

  const reset = useCallback(() => {
    resetProfile()
  }, [])

  return { profile: current, setProfile: update, resetProfile: reset }
}
