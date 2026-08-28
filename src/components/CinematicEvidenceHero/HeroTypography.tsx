import { motion, useTransform } from 'framer-motion'
import { Button } from '@/components/ui'
import type { HeroScrollValues } from './HeroScrollController'

/* ─── Masked line entrance (only for first phase) ─────────────────────────── */

function MaskedLine({ children, delay = 0, className = '' }: { children: string; delay?: number; className?: string }) {
  return (
    <span className={`block overflow-hidden ${className}`} aria-label={children}>
      <motion.span
        className="block pb-[0.1em]"
        initial={{ y: '110%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  )
}

/* ─── Phase label chip ─────────────────────────────────────────────────────── */

function PhaseLabel({ color, children }: { color: string; children: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className={`h-px w-8 ${color}`} />
      <div className={`font-mono text-xs ${color.replace('bg-', 'text-')}`}>{children}</div>
    </div>
  )
}

/* ─── Headline size ──────────────────────────────────────────────────────────
 * Sized so the longest single word ("CONFIDENCE") never wraps inside the
 * masked line at lg viewports — wrapping + overflow-hidden was clipping words.
 * ─────────────────────────────────────────────────────────────────────────── */

const HEADLINE = { fontSize: 'clamp(34px, 4.4vw, 62px)', fontWeight: 300 } as const
const HEADLINE_LG = { fontSize: 'clamp(42px, 5.2vw, 74px)', fontWeight: 300 } as const

/* ─── Main component ───────────────────────────────────────────────────────── */

export function HeroTypography({ values, navigate }: { values: HeroScrollValues; navigate: (path: string) => void }) {
  const raw = values.raw

  /* ── Text phase windows — synced to the artifact/graph choreography:
        ph1  intro            0.00 → 0.12
        ph2  ONE POST IS A CLAIM      (Instagram focus  ≈ 0.11–0.17)
        ph3  A CLAIM NEEDS A SOURCE   (LinkedIn focus   ≈ 0.28–0.33)
        ph4  A SOURCE NEEDS EVIDENCE  (Poster focus    ≈ 0.43–0.47, holds into CLAIM)
        ph5  EVIDENCE CAN DISAGREE    (graph forms     ≈ 0.66–0.82)
        ph6  SO TRUSTLIFY VERIFIES    (verifier        ≈ 0.84–0.91)
        ph7  INVESTIGATE BEFORE YOU ACT (decision, holds to end)
     Lines swap in place — the text block never leaves the viewport. ── */
  const ph1 = useTransform(raw, [0, 0.08, 0.12, 1], [1, 1, 0, 0])
  const ph2 = useTransform(raw, [0.1, 0.14, 0.22, 0.26], [0, 1, 1, 0])
  const ph3 = useTransform(raw, [0.24, 0.28, 0.35, 0.39], [0, 1, 1, 0])
  const ph4 = useTransform(raw, [0.37, 0.41, 0.64, 0.68], [0, 1, 1, 0])
  const ph5 = useTransform(raw, [0.66, 0.7, 0.81, 0.84], [0, 1, 1, 0])
  const ph6 = useTransform(raw, [0.82, 0.86, 0.9, 0.92], [0, 1, 1, 0])
  const ph7 = useTransform(raw, [0.9, 0.94, 0.999, 1], [0, 1, 1, 1])

  /* ── Phase text Y (small vertical swap, never off-screen) ── */
  const ph1y = useTransform(raw, [0.08, 0.12], [0, -22])
  const ph2y = useTransform(raw, [0.1, 0.14, 0.22, 0.26], [22, 0, 0, -22])
  const ph3y = useTransform(raw, [0.24, 0.28, 0.35, 0.39], [22, 0, 0, -22])
  const ph4y = useTransform(raw, [0.37, 0.41, 0.64, 0.68], [22, 0, 0, -22])
  const ph5y = useTransform(raw, [0.66, 0.7, 0.81, 0.84], [22, 0, 0, -22])
  const ph6y = useTransform(raw, [0.82, 0.86, 0.9, 0.92], [22, 0, 0, -22])
  const ph7y = useTransform(raw, [0.9, 0.94], [22, 0])

  /* ── Description fades with phase 1; CTA returns for the final call to action ──
   * Curves that must stay faded end explicitly at offset 1 — native WAAPI
   * inserts an implicit closing keyframe otherwise, ghosting text back in. */
  const descOpacity = useTransform(raw, [0, 0.08, 0.12, 1], [1, 1, 0, 0])
  const ctaOpacity = useTransform(raw, [0, 0.09, 0.13, 0.9, 0.94, 1], [1, 1, 0, 0, 1, 1])
  const ctaY = useTransform(raw, [0, 0.09, 0.13, 0.9, 0.94, 1], [0, 0, 16, 16, 0, 0])
  const scrollHintOpacity = useTransform(raw, [0, 0.05, 0.09, 1], [1, 1, 0, 0])

  /* ── Letter spacing on phase 1 (subtle) ── */
  const letterSpacing = useTransform(values.headlineTracking, (v: number) => `${v}em`)

  return (
    <div className="relative z-30 w-full max-w-[640px]">
      {/* ── Text phases (stacked, scroll-driven, swapped in place) ── */}
      <div className="relative min-h-[220px] sm:min-h-[280px]">

        {/* PHASE 1: INFORMATION IS EVERYWHERE / CONFIDENCE ISN'T */}
        <motion.div style={{ opacity: ph1, y: ph1y }} className="absolute inset-x-0 top-0">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px w-8 bg-violet" />
            <motion.div className="font-mono text-xs text-violet" style={{ letterSpacing }}>
              <MaskedLine delay={0.2}>INFORMATION IS EVERYWHERE.</MaskedLine>
            </motion.div>
          </div>
          <h1 className="font-display leading-[0.95]" style={HEADLINE_LG}>
            <MaskedLine delay={0.38}>CONFIDENCE</MaskedLine>
            <MaskedLine delay={0.58} className="italic text-lime">ISN'T.</MaskedLine>
          </h1>
        </motion.div>

        {/* PHASE 2: ONE POST IS A CLAIM — Instagram in focus */}
        <motion.div style={{ opacity: ph2, y: ph2y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-violet">CLAIM IDENTIFIED</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            ONE POST<br />IS A CLAIM.
          </h2>
        </motion.div>

        {/* PHASE 3: A CLAIM NEEDS A SOURCE — LinkedIn in focus */}
        <motion.div style={{ opacity: ph3, y: ph3y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-lime">SOURCE SEARCH</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            A CLAIM NEEDS<br />A SOURCE.
          </h2>
        </motion.div>

        {/* PHASE 4: A SOURCE NEEDS EVIDENCE — Poster in focus → CLAIM node forms */}
        <motion.div style={{ opacity: ph4, y: ph4y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-lime">EVIDENCE GATHERED</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            A SOURCE NEEDS<br />EVIDENCE.
          </h2>
        </motion.div>

        {/* PHASE 5: EVIDENCE CAN DISAGREE — graph drawing SOURCES → CONFLICT */}
        <motion.div style={{ opacity: ph5, y: ph5y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-caution">CONFLICT DETECTED</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            EVIDENCE CAN<br />DISAGREE.
          </h2>
        </motion.div>

        {/* PHASE 6: SO TRUSTLIFY VERIFIES — VERIFIER */}
        <motion.div style={{ opacity: ph6, y: ph6y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-violet">VERIFYING</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            SO TRUSTLIFY<br /><span className="italic text-lime">VERIFIES.</span>
          </h2>
        </motion.div>

        {/* PHASE 7: INVESTIGATE BEFORE YOU ACT — DECISION (holds to the end) */}
        <motion.div style={{ opacity: ph7, y: ph7y }} className="absolute inset-x-0 top-0">
          <PhaseLabel color="bg-lime">VERIFICATION COMPLETE</PhaseLabel>
          <h2 className="font-display leading-[0.95]" style={HEADLINE}>
            INVESTIGATE<br />BEFORE YOU <span className="italic text-lime">ACT.</span>
          </h2>
        </motion.div>
      </div>

      {/* ── Description (phase 1 only — hidden on small mobile to save height) ── */}
      <motion.p
        style={{ opacity: descOpacity }}
        className="mt-6 hidden max-w-md font-mono text-sm leading-7 text-soft sm:mt-8 sm:block md:text-base"
      >
        Trustlify investigates online opportunities, links, posts, screenshots and claims
        against real evidence before you click, apply, pay, or share personal information.
      </motion.p>

      {/* ── CTA buttons (phase 1, returning with the final line) ── */}
      <motion.div
        style={{ opacity: ctaOpacity, y: ctaY }}
        className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10"
      >
        <Button variant="lime" size="lg" onClick={() => navigate('/investigate')}>
          INVESTIGATE SOMETHING →
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate('/auth?mode=student')}>
          I'M A STUDENT
        </Button>
      </motion.div>

      {/* ── Scroll indicator (phase 1 only) ── */}
      <motion.div
        style={{ opacity: scrollHintOpacity }}
        className="mt-6 hidden items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-dim sm:mt-8 sm:flex"
      >
        <span className="h-10 w-px bg-gradient-to-b from-violet/0 via-violet to-violet/0" />
        <span>SCROLL TO EXPLORE THE EVIDENCE</span>
      </motion.div>
    </div>
  )
}
