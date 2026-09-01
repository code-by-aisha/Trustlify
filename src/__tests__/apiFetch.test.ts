/**
 * Trustlify Frontend — apiFetch Error Classification Tests
 *
 * "Failed to fetch" must never be shown to a user, and a request that never
 * received a response must not look like a 404 to the caller.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-access-token' } } }),
    },
  }),
}))

import { apiFetch, ApiError, BACKEND_UNREACHABLE_MESSAGE, API_BASE_URL } from '@/lib/supabase'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('attaches the Supabase access token and targets the configured backend', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { role: 'student' } }))

    await apiFetch('/api/profile')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/api/profile`)
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
    })
  })

  it('turns a transport failure into a safe message with status 0', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await apiFetch('/api/profile').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
    expect(err.message).toBe(BACKEND_UNREACHABLE_MESSAGE)
    expect(err.message).toBe('Unable to reach Trustlify server. Please try again.')
    expect(err.message).not.toContain('Failed to fetch')
  })

  it('preserves 404 so a missing profile stays distinguishable from a failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }),
    )

    const err = await apiFetch('/api/profile').catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
    expect(err.message).toBe('Profile not found')
  })

  it('masks a server-side failure and never leaks the upstream message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(500, { success: false, error: { code: 'PROFILE_UPDATE_FAILED', message: 'Failed to update profile' } }),
    )

    const err = await apiFetch('/api/profile', { method: 'PATCH' }).catch((e) => e)

    expect(err.status).toBe(500)
    expect(err.message).not.toContain('Failed to update profile')
    expect(err.message).toContain('Please try again.')
  })

  it('surfaces a validation message a user can act on', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'portfolioUrl must be a valid URL' } }),
    )

    const err = await apiFetch('/api/profile', { method: 'PATCH' }).catch((e) => e)

    expect(err.status).toBe(400)
    expect(err.message).toBe('portfolioUrl must be a valid URL')
  })
})
