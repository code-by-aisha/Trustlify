/**
 * HeroScrollController — maps a single scrollYProgress MotionValue (0→1)
 * to all the individual MotionValues that drive the cinematic journey.
 *
 * Story order: NOISE → POSTS (gallery sequence) → CLAIM → SOURCES →
 * EVIDENCE → CONFLICT → VERIFY → DECISION
 *
 * The evidence graph only begins forming AFTER the visual posts have passed.
 *
 * Every returned value is a Framer Motion MotionValue so it updates on the GPU
 * without triggering React re-renders.
 */
import { useTransform, type MotionValue } from 'framer-motion'

/* ─── Phase boundaries (fraction of total scroll progress 0→1) ────────────── */
export const PHASE = {
  NOISE_START: 0.0,
  POSTS_START: 0.05,
  CLAIM_START: 0.58,
  SOURCES_START: 0.66,
  EVIDENCE_START: 0.73,
  CONFLICT_START: 0.79,
  VERIFY_START: 0.86,
  DECISION_START: 0.92,
  END: 1.0,
} as const

/** Names exposed to the vertical phase timeline */
export const PHASE_LABELS = [
  'NOISE',
  'POSTS',
  'CLAIM',
  'SOURCES',
  'EVIDENCE',
  'CONFLICT',
  'VERIFY',
  'DECISION',
] as const
export type PhaseLabel = (typeof PHASE_LABELS)[number]

/** Ordered phase boundaries used for the timeline midpoints */
const PHASE_BOUNDS = [0, 0.05, 0.58, 0.66, 0.73, 0.79, 0.86, 0.92]

/** Midpoint of each phase — used to light up the timeline dot */
export const PHASE_MIDPOINTS = PHASE_BOUNDS.map((b, i) =>
  i < PHASE_BOUNDS.length - 1 ? (b + PHASE_BOUNDS[i + 1]) / 2 : (b + PHASE.END) / 2,
)

/* ─── Return type ──────────────────────────────────────────────────────────── */
export interface HeroScrollValues {
  /* ── Element visibility (opacity 0-1) ── */
  noiseOpacity: MotionValue<number>
  claimOpacity: MotionValue<number>
  sourceOpacity: MotionValue<number>
  evidenceOpacity: MotionValue<number>
  conflictOpacity: MotionValue<number>
  verifierOpacity: MotionValue<number>
  decisionOpacity: MotionValue<number>

  /* ── Artifact spatial state ── */
  /** 0 = fully scattered, 1 = fully converged around claim */
  artifactConvergence: MotionValue<number>
  /** 0 = normal, 1 = pushed back / faded (after decision) */
  sceneRecede: MotionValue<number>

  /* ── Network (progressive tree draw) ── */
  /** 0 = nothing drawn, 1 = all connection lines drawn (legacy) */
  networkDraw: MotionValue<number>
  /** Progressive draw per tree segment */
  sourceDraw: MotionValue<number>
  evidenceDraw: MotionValue<number>
  conflictDraw: MotionValue<number>
  verifierDraw: MotionValue<number>
  decisionDraw: MotionValue<number>
  /** conflict-specific network shake (0 = still, 1 = shaking) */
  conflictShake: MotionValue<number>

  /* ── Typography ── */
  headlineFade: MotionValue<number>
  headlineTracking: MotionValue<number>

  /* ── Orbital sphere ── */
  sphereOpacity: MotionValue<number>
  sphereScale: MotionValue<number>

  /* ── Parallax Y offsets (px) — multiplied by depth tier ── */
  parallaxBg: MotionValue<number>
  parallaxFar: MotionValue<number>
  parallaxMid: MotionValue<number>
  parallaxFg: MotionValue<number>
  parallaxNet: MotionValue<number>

  /* ── Raw progress for components that want to compute their own curves ── */
  raw: MotionValue<number>
}

/* ─── Hook ─────────────────────────────────────────────────────────────────── */
export function useHeroScroll(scrollYProgress: MotionValue<number>): HeroScrollValues {
  const P = PHASE

  /* ── Element visibility ── */
  const noiseOpacity = useTransform(scrollYProgress, [
    P.NOISE_START, P.POSTS_START, P.POSTS_START + 0.05,
  ], [1, 0.4, 0.05])

  const claimOpacity = useTransform(scrollYProgress, [
    P.CLAIM_START - 0.03, P.CLAIM_START + 0.03, 0.94, P.END,
  ], [0, 1, 1, 0.7])

  const sourceOpacity = useTransform(scrollYProgress, [
    P.SOURCES_START - 0.03, P.SOURCES_START + 0.03, 0.94, P.END,
  ], [0, 1, 1, 0.75])

  const evidenceOpacity = useTransform(scrollYProgress, [
    P.EVIDENCE_START - 0.03, P.EVIDENCE_START + 0.03, 0.94, P.END,
  ], [0, 1, 1, 0.75])

  const conflictOpacity = useTransform(scrollYProgress, [
    0.77, 0.815, 0.83, P.VERIFY_START,
  ], [0, 1, 1, 0])

  const verifierOpacity = useTransform(scrollYProgress, [
    P.VERIFY_START - 0.03, P.VERIFY_START + 0.03, 0.95, P.END,
  ], [0, 1, 1, 0.8])

  const decisionOpacity = useTransform(scrollYProgress, [
    P.DECISION_START - 0.03, P.DECISION_START + 0.03, P.END,
  ], [0, 1, 1])

  /* ── Artifact convergence ── */
  const artifactConvergence = useTransform(scrollYProgress, [
    P.NOISE_START, P.POSTS_START, 0.55,
  ], [0, 0.85, 1])

  const sceneRecede = useTransform(scrollYProgress, [
    P.DECISION_START + 0.05, P.END,
  ], [0, 1])

  /* ── Network (progressive tree draw — each segment reveals with its phase) ── */
  const networkDraw = useTransform(scrollYProgress, [
    P.SOURCES_START, P.VERIFY_START,
  ], [0, 1])

  const sourceDraw = useTransform(scrollYProgress, [
    P.SOURCES_START - 0.035, P.SOURCES_START + 0.025,
  ], [0, 1])

  const evidenceDraw = useTransform(scrollYProgress, [
    P.EVIDENCE_START - 0.035, P.EVIDENCE_START + 0.025,
  ], [0, 1])

  const conflictDraw = useTransform(scrollYProgress, [
    P.CONFLICT_START - 0.025, P.CONFLICT_START + 0.035,
  ], [0, 1])

  const verifierDraw = useTransform(scrollYProgress, [
    P.VERIFY_START - 0.03, P.VERIFY_START + 0.025,
  ], [0, 1])

  const decisionDraw = useTransform(scrollYProgress, [
    P.DECISION_START - 0.03, P.DECISION_START + 0.025,
  ], [0, 1])

  const conflictShake = useTransform(scrollYProgress, [
    0.79, 0.83, 0.855, 0.86,
  ], [0, 1, 0.3, 0])

  /* ── Typography ── */
  const headlineFade = useTransform(scrollYProgress, [
    P.NOISE_START, P.POSTS_START - 0.01, P.POSTS_START + 0.07,
  ], [1, 1, 0.35])

  const headlineTracking = useTransform(scrollYProgress, [
    P.NOISE_START, P.POSTS_START,
  ], [0, 0.04])

  /* ── Orbital sphere — present from the very start, grows gradually ── */
  const sphereOpacity = useTransform(scrollYProgress, [
    P.NOISE_START, P.POSTS_START, 0.30, 0.55, 0.75, P.DECISION_START, P.END,
  ], [0.2, 0.3, 0.42, 0.55, 0.66, 0.72, 0.4])
  const sphereScale = useTransform(scrollYProgress, [
    P.NOISE_START, 0.3, 0.6, P.DECISION_START, P.END,
  ], [0.8, 0.88, 0.96, 1.06, 0.96])

  /* ── Parallax Y (px) — negative = moves up as user scrolls ── */
  const parallaxBg  = useTransform(scrollYProgress, [0, 1], [0, -60])
  const parallaxFar = useTransform(scrollYProgress, [0, 1], [0, -110])
  const parallaxMid = useTransform(scrollYProgress, [0, 1], [0, -180])
  const parallaxFg  = useTransform(scrollYProgress, [0, 1], [0, -260])
  const parallaxNet = useTransform(scrollYProgress, [0, 1], [0, -70])

  return {
    noiseOpacity, claimOpacity, sourceOpacity, evidenceOpacity,
    conflictOpacity, verifierOpacity, decisionOpacity,
    artifactConvergence, sceneRecede,
    networkDraw,
    sourceDraw, evidenceDraw, conflictDraw, verifierDraw, decisionDraw,
    conflictShake,
    headlineFade, headlineTracking,
    sphereOpacity,
    sphereScale,
    parallaxBg, parallaxFar, parallaxMid, parallaxFg, parallaxNet,
    raw: scrollYProgress,
  }
}
