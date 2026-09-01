/**
 * Investigation state hook.
 * Polls the backend for REAL investigation state — the backend is the single
 * source of truth. No timers, no simulated progress, no fake stages.
 *
 * Backend contract (Phase 4):
 *   GET /api/investigations/:id → { status, currentStage, claims, sources,
 *   evidence, decision, events, ... }
 *
 * Polling continues while status is 'created' or 'processing' and stops on
 * 'complete' / 'failed'. Polling NEVER triggers AI or search calls — only the
 * backend investigation executor performs those.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/supabase'
import type { Investigation, InvestigationStage } from '@/types'

/* ─── Stage definitions (mirrors the backend pipeline, spec 32) ────────────── */

export interface StageMeta {
  id: InvestigationStage
  label: string
  desc: string
}

export const INVESTIGATION_STAGES: StageMeta[] = [
  { id: 'NORMALIZING',        label: 'Reading input',         desc: 'Validating and normalizing the submitted content' },
  { id: 'EXTRACTING_CONTENT', label: 'Extracting content',    desc: 'Fetching the actual page or file content — never claims from a URL string' },
  { id: 'EXTRACTING_CLAIMS',  label: 'Extracting claims',     desc: 'AI extracts discrete factual claims from the content' },
  { id: 'SEARCHING',          label: 'Finding sources',       desc: 'Up to three targeted web searches built from the priority claims' },
  { id: 'READING_SOURCES',    label: 'Reading sources',       desc: 'Fetching full content from the most relevant discovered sources' },
  { id: 'ANALYZING_EVIDENCE', label: 'Analyzing evidence',    desc: 'AI compares claims against source content — every excerpt is verified' },
  { id: 'CALCULATING_TRUST',  label: 'Calculating trust',     desc: 'The deterministic Trust Engine computes verdict, score, and reasons — never the AI' },
  { id: 'COMPLETE',           label: 'Investigation complete', desc: 'Verdict, trust score, and reasons are ready' },
]

/**
 * Stages that apply to a given input. Text input has no content-extraction
 * stage — the backend pipeline skips it, so the progress UI does too.
 */
export function stagesForInput(inputType: string | null | undefined): StageMeta[] {
  if (inputType === 'text') {
    return INVESTIGATION_STAGES.filter((s) => s.id !== 'EXTRACTING_CONTENT')
  }
  return INVESTIGATION_STAGES
}

/**
 * Map a backend stage string to its index in the stage list.
 * Unknown/legacy values map to 0 (NORMALIZING) so the UI never crashes on
 * unexpected data — the backend remains authoritative.
 */
export function stageIndexOf(
  stage: string | null | undefined,
  stages: StageMeta[] = INVESTIGATION_STAGES,
): number {
  const index = stages.findIndex((s) => s.id === stage)
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
