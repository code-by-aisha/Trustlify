/**
 * Investigation state hook.
 * Polls the backend for REAL investigation state — the backend is the single
 * source of truth. No timers, no simulated progress, no fake stages.
 *
 * Backend contract (Phase 3C):
 *   GET /api/investigations/:id → { status, currentStage, claims, sources, events, ... }
 *
 * Polling continues while status is 'created' or 'processing' and stops on
 * 'complete' / 'failed'. Polling NEVER triggers AI or search calls — only the
 * backend investigation executor performs those.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/supabase'
import type { Investigation, InvestigationStage } from '@/types'

/* ─── Stage definitions (mirrors the backend mini pipeline) ────────────────── */

export interface StageMeta {
  id: InvestigationStage
  label: string
  desc: string
}

export const INVESTIGATION_STAGES: StageMeta[] = [
  { id: 'NORMALIZING', label: 'Reading input',        desc: 'Validating and normalizing the submitted content' },
  { id: 'CLAIMS',      label: 'Extracting claims',     desc: 'AI extracts discrete factual claims' },
  { id: 'SEARCH',      label: 'Finding sources',       desc: 'One targeted web search built from the priority claim' },
  { id: 'SOURCES',     label: 'Recording sources',     desc: 'Normalizing and storing discovered sources' },
  { id: 'COMPLETE',    label: 'Investigation complete', desc: 'Claims and sources recorded — verification arrives in a later phase' },
]

/**
 * Map a backend stage string to its index in INVESTIGATION_STAGES.
 * Unknown/legacy values map to 0 (NORMALIZING) so the UI never crashes on
 * unexpected data — the backend remains authoritative.
 */
export function stageIndexOf(stage: string | null | undefined): number {
  const index = INVESTIGATION_STAGES.findIndex((s) => s.id === stage)
  return index >= 0 ? index : 0
}

/* ─── Hook ─────────────────────────────────────────────────────────────────── */

const POLL_INTERVAL_MS = 1500
/** Consecutive failed polls before surfacing an error and stopping. */
const MAX_POLL_FAILURES = 4

export interface UseInvestigationReturn {
  /** Full investigation state from the backend (null until first load). */
  investigation: Investigation | null
  /** True during the initial fetch. */
  isLoading: boolean
  /** Polling/network error message (safe, user-facing). */
  error: string | null
  /** True when the investigation does not exist or is not owned by the user. */
  notFound: boolean
  /** Trigger an immediate re-fetch. */
  refresh: () => void
}

export function useInvestigation(
  investigationId: string | undefined,
): UseInvestigationReturn {
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  /** Latest status — kept in a ref so the poll interval can decide to stop. */
  const statusRef = useRef<string | null>(null)
  /** Consecutive poll failures (reset on any success). */
  const failuresRef = useRef(0)
  const mountedRef = useRef(true)

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!investigationId) return

    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const fetchOnce = async (): Promise<'stop' | 'continue'> => {
      try {
        const res = await apiFetch(`/api/investigations/${investigationId}`)
        if (cancelled || !mountedRef.current) return 'stop'

        const inv = res?.data as Investigation | undefined
        if (!inv) {
          setNotFound(true)
          setError('Investigation not found')
          return 'stop'
        }

        failuresRef.current = 0
        setNotFound(false)
        setError(null)
        setInvestigation(inv)
        statusRef.current = inv.status

        if (inv.status === 'complete' || inv.status === 'failed') {
          return 'stop'
        }
        return 'continue'
      } catch (err) {
        if (cancelled || !mountedRef.current) return 'stop'

        failuresRef.current += 1
        if (failuresRef.current === 1) {
          // Distinguish 404 (not found / forbidden) from transient errors
          const message = err instanceof Error ? err.message : ''
          if (/not found|forbidden|access/i.test(message)) {
            setNotFound(true)
            setError(message || 'Investigation not found')
            return 'stop'
          }
        }
        if (failuresRef.current >= MAX_POLL_FAILURES) {
          setError(
            err instanceof Error
              ? err.message
              : 'Lost connection to the investigation service',
          )
          return 'stop'
        }
        return 'continue'
      }
    }

    const run = async () => {
      setIsLoading(true)
      const outcome = await fetchOnce()
      if (cancelled || !mountedRef.current) return
      setIsLoading(false)

      if (outcome === 'continue') {
        const schedule = () => {
          pollTimer = setTimeout(async () => {
            if (cancelled || !mountedRef.current) return
            const next = await fetchOnce()
            if (next === 'continue' && !cancelled && mountedRef.current) {
              schedule()
            }
          }, POLL_INTERVAL_MS)
        }
        schedule()
      }
    }

    void run()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [investigationId, refreshTick])

  return { investigation, isLoading, error, notFound, refresh }
}
