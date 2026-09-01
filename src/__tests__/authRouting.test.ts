/**
 * Trustlify Frontend — Post-auth Routing Tests
 *
 * Covers the "existing student sent back through onboarding" bug: a profile
 * request that fails is NOT evidence that the user is new.
 */

import { describe, it, expect } from 'vitest'
import { resolvePostAuthRoute } from '@/lib/authRouting'

const STUDENT_PROFILE = {
  exists: true,
  notFound: false,
  loadError: null,
  role: 'student',
  name: 'Aisha',
  personaMode: 'general' as const,
}

describe('resolvePostAuthRoute', () => {
  it('sends an existing student to the dashboard, not onboarding', () => {
    expect(resolvePostAuthRoute(STUDENT_PROFILE).path).toBe('/dashboard')
  })

  it('treats the persisted role as the source of truth over the login persona', () => {
    // Persona says "general", persisted profile says student with no name yet.
    const route = resolvePostAuthRoute({
      ...STUDENT_PROFILE,
      name: '',
      personaMode: 'general',
    })
    expect(route.path).toBe('/student/onboarding')
  })

  it('does not treat a failed profile request as a missing profile', () => {
    const route = resolvePostAuthRoute({
      exists: false,
      notFound: false,
      loadError: 'Unable to reach Trustlify server. Please try again.',
      role: null,
      name: null,
      personaMode: 'student',
    })
    expect(route.path).toBe('/dashboard')
    expect(route.unverified).toBe(true)
  })

  it('sends a confirmed brand-new student to onboarding', () => {
    const route = resolvePostAuthRoute({
      exists: false,
      notFound: true,
      loadError: null,
      role: null,
      name: null,
      personaMode: 'student',
    })
    expect(route.path).toBe('/student/onboarding')
    expect(route.unverified).toBe(false)
  })

  it('sends a confirmed brand-new general user to the dashboard', () => {
    const route = resolvePostAuthRoute({
      exists: false,
      notFound: true,
      loadError: null,
      role: null,
      name: null,
      personaMode: 'general',
    })
    expect(route.path).toBe('/dashboard')
  })
})
