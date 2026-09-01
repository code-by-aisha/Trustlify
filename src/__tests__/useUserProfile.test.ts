/**
 * Trustlify Frontend — useUserProfile Tests
 *
 * The two reported bugs live in this hook's state machine: an existing student
 * profile must hydrate rather than look "new", and a request that never got a
 * response must not be reported as a missing profile.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { apiFetch, ApiError, BACKEND_UNREACHABLE_MESSAGE } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

const auth = vi.hoisted(() => ({
  state: { user: null as { id: string } | null, loading: true },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.state }))

vi.mock('@/lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase')>()
  return { ...actual, apiFetch: vi.fn() }
})

const STUDENT_ROW = {
  id: 'profile-1',
  userId: 'u1',
  role: 'student',
  displayName: 'Aisha Fayaz',
  education: "Matric / O-Levels",
  age: 18,
  location: 'Karachi',
  skills: ['Research'],
  interests: ['Scholarships'],
  experience: null,
  portfolioUrl: null,
  language: 'English',
  timezone: 'Asia/Karachi',
  notificationPreferences: {},
}

function signInAsStudent() {
  auth.state = { user: { id: 'u1' }, loading: false }
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
  auth.state = { user: null, loading: true }
})

describe('useUserProfile', () => {
  it('does not request the profile before the session is restored', async () => {
    const { rerender } = renderHook(() => useUserProfile())
    expect(apiFetch).not.toHaveBeenCalled()

    signInAsStudent()
    rerender()

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe('/api/profile')
  })

  it('hydrates an existing student profile instead of reporting no profile', async () => {
    signInAsStudent()
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: STUDENT_ROW })

    const { result } = renderHook(() => useUserProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exists).toBe(true)
    expect(result.current.notFound).toBe(false)
    expect(result.current.loadError).toBeNull()
    expect(result.current.profile.role).toBe('student')
    expect(result.current.profile.name).toBe('Aisha Fayaz')
    expect(result.current.loadedFor).toBe('u1')
  })

  it('reads a 404 as a genuinely missing profile with no load error', async () => {
    signInAsStudent()
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('Profile not found', 404))

    const { result } = renderHook(() => useUserProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exists).toBe(false)
    expect(result.current.notFound).toBe(true)
    expect(result.current.loadError).toBeNull()
  })

  it('keeps a failed request separate from a missing profile', async () => {
    signInAsStudent()
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(BACKEND_UNREACHABLE_MESSAGE, 0))

    const { result } = renderHook(() => useUserProfile())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.exists).toBe(false)
    expect(result.current.notFound).toBe(false)
    expect(result.current.loadError).toBe('Unable to reach Trustlify server. Please try again.')
  })

  it('retries the profile request on demand', async () => {
    signInAsStudent()
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(BACKEND_UNREACHABLE_MESSAGE, 0))

    const { result } = renderHook(() => useUserProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: STUDENT_ROW })
    await act(async () => result.current.reload())

    await waitFor(() => expect(result.current.exists).toBe(true))
    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(result.current.loadError).toBeNull()
  })

  it('persists a save and adopts the returned profile', async () => {
    signInAsStudent()
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: STUDENT_ROW })

    const { result } = renderHook(() => useUserProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const saved = { displayName: 'Aisha Fayaz', role: 'student', location: 'Lahore' }
    let outcome: { error: string | null } = { error: 'not called' }
    await act(async () => {
      outcome = await result.current.createProfile(saved)
    })

    expect(outcome.error).toBeNull()
    const [, init] = vi.mocked(apiFetch).mock.calls[1]
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(saved) })
    expect(result.current.exists).toBe(true)
  })

  it('reports a server-side save failure with a safe message', async () => {
    signInAsStudent()
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ success: true, data: STUDENT_ROW })
      .mockRejectedValueOnce(new ApiError('Trustlify could not complete that request. Please try again.', 500))

    const { result } = renderHook(() => useUserProfile())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome: { error: string | null } = { error: 'not called' }
    await act(async () => {
      outcome = await result.current.createProfile({ displayName: 'Aisha Fayaz' })
    })

    expect(outcome.error).toBe('Profile could not be saved. Please try again.')
  })
})
