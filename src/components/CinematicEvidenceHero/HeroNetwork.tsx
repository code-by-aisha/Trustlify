import { motion, useTransform } from 'framer-motion'
import type { HeroPointerValues } from './HeroPointerController'
import type { HeroScrollValues } from './HeroScrollController'

function MiniNode({ label, title, meta, tone = 'violet' }: { label: string; title: string; meta?: string; tone?: 'violet' | 'lime' | 'amber' | 'green' }) {
  const toneClass = tone === 'lime'
    ? 'border-lime/30 shadow-[0_0_34px_rgba(163,255,18,0.12)]'
    : tone === 'amber'
      ? 'border-caution/35 shadow-[0_0_34px_rgba(245,185,66,0.12)]'
      : tone === 'green'
        ? 'border-lime/40 shadow-[0_0_44px_rgba(163,255,18,0.18)]'
        : 'border-violet/40 shadow-[0_0_34px_rgba(124,58,237,0.18)]'
  const textClass = tone === 'lime' ? 'text-lime' : tone === 'amber' ? 'text-caution' : tone === 'green' ? 'text-lime' : 'text-violet'

  return (
    <div className={`rounded-2xl border bg-[rgba(17,17,24,0.74)] p-4 backdrop-blur-xl ${toneClass}`}>
      <div className={`mb-2 font-mono text-[10px] tracking-[0.18em] ${textClass}`}>{label}</div>
      <div className="font-mono text-[13px] font-semibold leading-snug text-bone">{title}</div>
      {meta && <div className="mt-2 font-mono text-[10px] leading-relaxed text-dim">{meta}</div>}
    </div>
  )
}

export function HeroNetwork({ values, pointer }: { values: HeroScrollValues; pointer: HeroPointerValues }) {
  const conflictX = useTransform(values.conflictShake, [0, 0.5, 1], [0, -6, 6])

  /* Progressive path-draw offsets (one per tree segment) */
  const sourceOffset = useTransform(values.sourceDraw, [0, 1], [1, 0])
  const evidenceOffset = useTransform(values.evidenceDraw, [0, 1], [1, 0])
  const conflictOffset = useTransform(values.conflictDraw, [0, 1], [1, 0])
  const verifierOffset = useTransform(values.verifierDraw, [0, 1], [1, 0])
  const decisionOffset = useTransform(values.decisionDraw, [0, 1], [1, 0])

  /*
   * Evidence tree (top → bottom):
   *
   *         CLAIM
   *        /     \
   *   SOURCE A   SOURCE B
   *      |           |
   *  EVIDENCE    CONFLICT
   *        \     /
   *       VERIFIER
   *          |
   *       DECISION
   */
  return (
    <motion.div
      className="absolute inset-0 hidden pointer-events-none lg:block overflow-hidden"
      style={{ y: values.parallaxNet }}
      aria-hidden="true"
    >
      <motion.div style={{ x: pointer.midX, y: pointer.midY }} className="absolute inset-0">

        {/* ── SVG connecting lines ── */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="networkGlow">
              <feGaussianBlur stdDeviation="0.25" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g fill="none" strokeLinecap="round" filter="url(#networkGlow)">
            {/* Claim → Source A */}
            <motion.path
              d="M46 14 C42 18 38 22 36 26"
              stroke="#7C3AED" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.sourceDraw, pathOffset: sourceOffset, opacity: values.sourceOpacity }}
            />
            {/* Claim → Source B */}
            <motion.path
              d="M46 14 C50 18 58 22 62 26"
              stroke="#7C3AED" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.sourceDraw, pathOffset: sourceOffset, opacity: values.sourceOpacity }}
            />
            {/* Source A → Evidence */}
            <motion.path
              d="M36 34 C36 38 36 42 36 46"
              stroke="#A3FF12" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.evidenceDraw, pathOffset: evidenceOffset, opacity: values.evidenceOpacity }}
            />
            {/* Source B → Conflict */}
            <motion.path
              d="M62 34 C62 38 62 42 62 46"
              stroke="#A3FF12" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.evidenceDraw, pathOffset: evidenceOffset, opacity: values.evidenceOpacity }}
            />
            {/* Evidence + Conflict → Verifier (converge) */}
            <motion.path
              d="M36 54 C40 58 44 62 46 66"
              stroke="#F5B942" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.conflictDraw, pathOffset: conflictOffset, opacity: values.conflictOpacity }}
            />
            <motion.path
              d="M62 54 C58 58 52 62 46 66"
              stroke="#F5B942" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.conflictDraw, pathOffset: conflictOffset, opacity: values.conflictOpacity }}
            />
            {/* Convergence → Verifier */}
            <motion.path
              d="M46 66 C46 70 46 73 46 76"
              stroke="#7C3AED" strokeWidth="0.25" strokeDasharray="1"
              style={{ pathLength: values.verifierDraw, pathOffset: verifierOffset, opacity: values.verifierOpacity }}
            />
            {/* Verifier → Decision */}
            <motion.path
              d="M46 78 C46 82 46 86 46 90"
              stroke="#A3FF12" strokeWidth="0.3" strokeDasharray="1"
              style={{ pathLength: values.decisionDraw, pathOffset: decisionOffset, opacity: values.decisionOpacity }}
            />
          </g>
          {/* Junction dots */}
          {[
            [46, 14, '#7C3AED'], [36, 30, '#A3FF12'], [62, 30, '#A3FF12'],
            [36, 50, '#A3FF12'], [62, 50, '#F5B942'], [46, 66, '#F5B942'], [46, 76, '#7C3AED'], [46, 92, '#A3FF12'],
          ].map(([cx, cy, fill], i) => (
            <circle key={i} cx={cx} cy={cy} r="0.45" fill={fill as string} opacity="0.7" />
          ))}
        </svg>

        {/* ── Nodes ── */}
        <motion.div
          className="absolute left-[36%] top-[4%] w-[180px]"
          style={{ opacity: values.claimOpacity }}
        >
          <MiniNode label="CLAIM" title={'"Fully funded scholarship for international students"'} meta="Deadline: Aug 30, 2025" />
        </motion.div>

        <motion.div
          className="absolute left-[24%] top-[22%] w-[175px]"
          style={{ opacity: values.sourceOpacity }}
        >
          <MiniNode label="OFFICIAL SOURCE" title="University Website" meta="Updated 2 days ago · VERIFIED" tone="lime" />
        </motion.div>

        <motion.div
          className="absolute left-[52%] top-[22%] w-[175px]"
          style={{ opacity: values.sourceOpacity }}
        >
          <MiniNode label="INDEPENDENT SOURCE" title="Education Portal" meta="Published Aug 20 · VERIFIED" tone="lime" />
        </motion.div>

        <motion.div
          className="absolute left-[24%] top-[42%] w-[165px]"
          style={{ opacity: values.evidenceOpacity }}
        >
          <MiniNode label="EVIDENCE" title="4 supporting sources" meta="Deadline · eligibility · official update" />
        </motion.div>

        <motion.div
          className="absolute left-[52%] top-[42%] w-[170px]"
          style={{ opacity: values.conflictOpacity, x: conflictX }}
        >
          <MiniNode label="CONFLICT DETECTED" title="Different deadline in 1 source" meta="Fragment being verified" tone="amber" />
        </motion.div>

        <motion.div
          className="absolute left-[35%] top-[62%] w-[185px]"
          style={{ opacity: values.verifierOpacity }}
        >
          <MiniNode label="VERIFIER" title="Cross-checking facts & dates…" meta="Unsupported evidence fades" />
        </motion.div>

        {/* ── DECISION node ── */}
        <motion.div
          className="absolute left-[35%] top-[78%] w-[185px]"
          style={{ opacity: values.decisionOpacity }}
        >
          <MiniNode label="DECISION" title="VERIFY BEFORE APPLYING" meta="62/100 · Moderate confidence" tone="green" />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
