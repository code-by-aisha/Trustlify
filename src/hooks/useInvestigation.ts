/**
 * Investigation state machine hook.
 * Single source of truth for mock investigation progress.
 * Architecture: replace setTimeout with SSE/WebSocket for real backend.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { InvestigationStage } from '@/types'

/* ─── Stage definitions ─────────────────────────────────────────────────── */

export interface StageMeta {
  id: InvestigationStage
  label: string
  desc: string
  duration: number // ms in mock mode
}

export const INVESTIGATION_STAGES: StageMeta[] = [
  { id: 'NORMALIZING',   label: 'Reading input',        desc: 'Parsing URL structure, headers, and content signals',        duration: 1200 },
  { id: 'CLAIMS',        label: 'Extracting claims',     desc: '3 key claims identified and classified',                   duration: 1500 },
  { id: 'SEARCH',        label: 'Finding sources',       desc: '7 relevant sources located across official and public data', duration: 2000 },
  { id: 'EVIDENCE',      label: 'Comparing evidence',    desc: 'Cross-referencing sources for consistency',                 duration: 1800 },
  { id: 'INVESTIGATING', label: 'Investigating deeply',  desc: 'Domain analysis, red flag detection, currentness check',    duration: 1500 },
  { id: 'VERIFYING',     label: 'Verifying conclusions', desc: 'Assembling evidence relationships',                         duration: 1200 },
  { id: 'MATCHING',      label: 'Matching profile',      desc: 'Comparing against your student profile',                    duration: 1000 },
  { id: 'DECIDING',      label: 'Deciding verdict',      desc: 'Computing final evidence score and guidance',               duration: 1200 },
  { id: 'COMPLETE',      label: 'Investigation complete', desc: 'All checks finished — verdict ready',                      duration: 0 },
]

/* ─── Hook ───────────────────────────────────────────────────────────────── */

export interface UseInvestigationReturn {
  /** Current stage identifier */
  currentStage: InvestigationStage
  /** Index of the current stage (0-based) */
  stageIndex: number
  /** Total number of stages */
  totalStages: number
  /** Overall progress 0→1 */
  progress: number
  /** Metadata for the current stage */
  stageMeta: StageMeta
  /** Whether the investigation has completed all stages */
  isComplete: boolean
  /** Whether a conflict has been detected (flips at VERIFYING) */
  conflictDetected: boolean
  /** Elapsed time in seconds since start */
  elapsed: number
  /** Start the investigation from the beginning */
  start: () => void
  /** Reset the state machine to idle */
  reset: () => void
}

export function useInvestigation(
  config?: { autoStart?: boolean; speedMultiplier?: number }
): UseInvestigationReturn {
  const { autoStart = true, speedMultiplier = 1 } = config ?? {}

  const [stageIndex, setStageIndex] = useState(0)
  const [started, setStarted] = useState(autoStart)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalStages = INVESTIGATION_STAGES.length
  const currentMeta = INVESTIGATION_STAGES[stageIndex]
  const isComplete = stageIndex >= totalStages - 1
  // Conflict is detected once we reach VERIFYING (index 5) or beyond
  const conflictDetected = stageIndex >= 5

  /* Advance to next stage after current stage's duration */
  useEffect(() => {
    if (!started || isComplete) return

    const duration = currentMeta.duration / speedMultiplier
    timerRef.current = setTimeout(() => {
      setStageIndex((i) => Math.min(i + 1, totalStages - 1))
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [started, stageIndex, isComplete, currentMeta.duration, speedMultiplier, totalStages])

  /* Track elapsed time */
  useEffect(() => {
    if (started && !isComplete) {
      if (!startTimeRef.current) startTimeRef.current = Date.now()
      elapsedTimerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    }
  }, [started, isComplete])

  const start = useCallback(() => {
    setStageIndex(0)
    setElapsed(0)
    startTimeRef.current = Date.now()
    setStarted(true)
  }, [])

  const reset = useCallback(() => {
    setStageIndex(0)
    setElapsed(0)
    startTimeRef.current = 0
    setStarted(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
  }, [])

  return {
    currentStage: currentMeta.id,
    stageIndex,
    totalStages,
    progress: stageIndex / (totalStages - 1),
    stageMeta: currentMeta,
    isComplete,
    conflictDetected,
    elapsed,
    start,
    reset,
  }
}
