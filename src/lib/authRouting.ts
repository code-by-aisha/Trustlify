/**
 * Trustlify Frontend — Post-auth routing decision
 *
 * Pure, dependency-free so the rule that decides "onboarding or dashboard" can
 * be tested directly. The persisted profile row is the source of truth for the
 * role; the login form's persona toggle is only consulted for a user whose
 * profile row the server has confirmed is absent.
 */

export type PersonaMode = 'student' | 'general' | 'choose'

export interface ProfileRouteState {
  /** GET /api/profile returned a row */
  exists: boolean
  /** GET /api/profile returned 404 — confirmed no row yet */
  notFound: boolean
  /** The profile request could not be completed (unreachable, 401, 429, 5xx) */
  loadError: string | null
  /** Role persisted on the profile row */
  role?: string | null
  /** Display name persisted on the profile row */
  name?: string | null
  /** Persona picked on the login/signup form */
  personaMode: PersonaMode
}

export interface PostAuthRoute {
  path: '/dashboard' | '/student/onboarding'
  /**
   * True when the profile could not be verified. The user is sent to the
   * dashboard rather than first-time onboarding, because re-submitting the
   * onboarding form would overwrite a real profile that we simply could not
   * read.
   */
  unverified: boolean
}

export function resolvePostAuthRoute(state: ProfileRouteState): PostAuthRoute {
  // A failed read is not a missing profile — never treat it as a new user.
  if (!state.exists && state.loadError) {
    return { path: '/dashboard', unverified: true }
  }

  if (!state.exists) {
    // Confirmed brand-new account (404): the chosen persona decides the start.
    return {
      path: state.personaMode === 'student' ? '/student/onboarding' : '/dashboard',
      unverified: false,
    }
  }

  // Existing profile: persisted role wins over any temporary UI persona state.
  const studentMissingBasics = state.role === 'student' && !state.name
  return {
    path: studentMissingBasics ? '/student/onboarding' : '/dashboard',
    unverified: false,
  }
}
