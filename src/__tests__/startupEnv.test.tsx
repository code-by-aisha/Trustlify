/**
 * Trustlify Frontend — Startup Environment Gate Tests
 *
 * A build that ships without the Supabase variables used to render a black page:
 * the client threw while its module was still being imported, before React ran.
 * These hold both halves of the fix in place - detection, and a readable screen.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import StartupError from '@/components/StartupError'
import { checkStartupEnv, missingRequiredEnv } from '@/lib/env'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('missingRequiredEnv', () => {
  it('names every variable that was not inlined into the build', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')

    expect(missingRequiredEnv()).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
  })

  it('stays silent when the build carried the values', () => {
    expect(missingRequiredEnv()).toEqual([])
  })
})

describe('checkStartupEnv', () => {
  it('warns about a production build left pointing at the dev API default', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_BASE_URL', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(checkStartupEnv()).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('VITE_API_BASE_URL')
    )
  })
})

describe('StartupError', () => {
  it('states which variables are missing and what to do about them', () => {
    const { container } = render(<StartupError missing={['VITE_SUPABASE_URL']} />)

    expect(container.textContent).toContain('Trustlify could not start')
    expect(container.textContent).toContain('Missing variables')
    expect(container.textContent).toContain('VITE_SUPABASE_URL')
    expect(container.textContent).toMatch(/new deploy/i)
  })

  it('surfaces a module-load failure when the configuration looks complete', () => {
    const { container } = render(
      <StartupError missing={[]} detail='Failed to fetch dynamically imported module' />
    )

    expect(container.textContent).toContain('Failed to fetch dynamically imported module')
    // Nothing is missing, so the variable list must not imply that it is.
    expect(container.textContent).not.toContain('Missing variables')
  })
})
