import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView as useFramerInView, type MotionValue, type UseScrollOptions } from 'framer-motion'
import { MarketingHeader } from '@/components/AppShell'
import { Button, StatusBadge, SectionLabel } from '@/components/ui'
import { TrustlifyLogo } from '@/components/TrustlifyLogo'
import { CinematicEvidenceHero } from '@/components/CinematicEvidenceHero'
import { useInView } from '@/hooks/useScroll'

/* ─── REVEAL WRAPPER ─────────────────────────────────────────────────────── */

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [ref, inView] = useInView({ threshold: 0.12 })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  )
}

/* ─── PROBLEM ────────────────────────────────────────────────────────────── */

function ProblemSection() {
  const steps = ['POST', 'SEARCH', 'OFFICIAL WEBSITE', 'ANOTHER SOURCE', 'DEADLINE', 'ELIGIBILITY', 'REVIEWS', 'DECISION']
  return (
    <section id="problem" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <Reveal>
            <SectionLabel>THE PROBLEM</SectionLabel>
            <h2 className="font-display leading-tight mb-6" style={{ fontSize: 'clamp(36px,4vw,60px)', fontWeight: 300 }}>
              SEEING INFORMATION<br />IS EASY.<br />
              <span className="text-soft">KNOWING WHAT TO TRUST ISN'T.</span>
            </h2>
            <p className="font-mono text-sm text-soft leading-relaxed">
              Before you trust the opportunity, investigate the evidence. One claim, multiple sources, one accountable decision.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <div className="space-y-0">
                {steps.map((step, i) => (
                  <div key={step} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full border flex-shrink-0"
                        style={{
                          borderColor: i === steps.length - 1 ? '#A3FF12' : i > 4 ? '#F5B942' : 'rgba(255,255,255,0.2)',
                          background: i === steps.length - 1 ? '#A3FF12' : 'transparent',
                        }} />
                      {i < steps.length - 1 && (
                        <div className="w-px flex-1 min-h-[24px]" style={{
                          background: i > 4 ? 'rgba(245,185,66,0.3)' : 'rgba(255,255,255,0.08)',
                          marginTop: 2, marginBottom: 2,
                        }} />
                      )}
                    </div>
                    <div className={`py-2 font-mono text-xs tracking-wider transition-all ${
                      i === steps.length - 1 ? 'text-lime'
                      : i > 4 ? 'text-caution opacity-80'
                      : i > 2 ? 'text-dim' : 'text-soft'
                    }`}>
                      {step}
                      {i > 2 && i < steps.length - 1 && (
                        <span className="ml-2 text-[9px] text-dim">
                          {i === 3 ? 'conflicting?' : i === 4 ? 'which one?' : i === 5 ? 'am I eligible?' : 'mixed reviews'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-[rgba(245,185,66,0.05)] border border-[rgba(245,185,66,0.1)] flex items-center justify-center">
                <span className="font-mono text-[10px] text-caution text-center leading-tight">MANUAL<br />PROCESS</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── HOW IT WORKS ───────────────────────────────────────────────────────── */

function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  } as UseScrollOptions)
  const lineWidth = useTransform(scrollYProgress, [0.15, 0.65], ['0%', '100%'])

  const stages = [
    { num: '01', title: 'UNDERSTAND', desc: 'Trustlify reads your input — link, text, screenshot, or PDF — and identifies what it contains.', icon: '◎', visual: 'INPUT CAPTURE', vMeta: 'Link · text · image · PDF' },
    { num: '02', title: 'INVESTIGATE', desc: 'Claims are extracted and cross-referenced against official, independent, and public sources.', icon: '⊹', visual: 'SOURCE SEARCH', vMeta: 'Official · independent · public' },
    { num: '03', title: 'COMPARE', desc: 'Sources are ranked by authority and compared for consistency. Conflicts are highlighted.', icon: '⇄', visual: 'EVIDENCE MATCH', vMeta: 'Authority · consistency · conflicts' },
    { num: '04', title: 'VERIFY', desc: 'Evidence relationships are mapped. Facts separated from interpretations explicitly.', icon: '✓', visual: 'CONFLICT MAP', vMeta: 'Facts · interpretations · gaps' },
    { num: '05', title: 'DECIDE', desc: 'A clear verdict with actionable next steps. Evidence remains accessible.', icon: '→', visual: 'VERDICT', vMeta: 'Score · guidance · next steps' },
  ]

  return (
    <section ref={sectionRef} id="how-it-works" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <SectionLabel>HOW TRUSTLIFY WORKS</SectionLabel>
          <h2 className="font-display mb-16" style={{ fontSize: 'clamp(36px,4vw,60px)', fontWeight: 300 }}>
            FIVE STAGES.<br /><span className="text-soft">ONE COHERENT INVESTIGATION.</span>
          </h2>
        </Reveal>

        {/* ── Scroll-responsive timeline ── */}
        <div className="relative">
          {/* Connecting line (fills on scroll) */}
          <div className="hidden lg:block absolute top-5 left-0 right-0 h-px bg-white/[0.06]">
            <motion.div className="h-full bg-gradient-to-r from-violet via-violet to-lime" style={{ width: lineWidth }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-5">
            {stages.map((stage, i) => (
              <StageCard key={stage.num} stage={stage} index={i} total={stages.length} sectionProgress={scrollYProgress} />
            ))}
          </div>
        </div>

        {/* ── Stage detail panel ── */}
        <Reveal delay={0.2}>
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="card-noir-violet p-8">
              <div className="font-mono text-[10px] text-violet tracking-widest mb-3">INVESTIGATION PROCESS</div>
              <p className="font-mono text-sm text-soft leading-relaxed">
                Each stage builds on the previous one. As you scroll through, Trustlify maps claims against evidence progressively — never jumping to conclusions, never skipping sources.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-violet to-lime rounded-full" style={{ width: lineWidth }} />
                </div>
                <span className="font-mono text-[10px] text-dim">INVESTIGATION PROGRESS</span>
              </div>
            </div>
            <div className="card-noir p-8">
              <div className="font-mono text-[10px] text-dim tracking-wider mb-3">EACH INVESTIGATION PRODUCES</div>
              {[
                { label: 'Claim extraction', done: true },
                { label: 'Source verification', done: true },
                { label: 'Conflict detection', done: true },
                { label: 'Evidence relationships', done: false },
                { label: 'Accountable verdict', done: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <span className={`font-mono text-xs ${item.done ? 'text-lime' : 'text-dim'}`}>{item.done ? '✓' : '○'}</span>
                  <span className="font-mono text-xs text-soft">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function StageCard({ stage, index, total, sectionProgress }: {
  stage: { num: string; title: string; desc: string; icon: string; visual: string; vMeta: string }
  index: number; total: number; sectionProgress: MotionValue<number>
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const isInView = useFramerInView(cardRef, { once: false, amount: 0.5 })

  const segStart = 0.15 + (index / total) * 0.5
  const segEnd = segStart + 0.12
  const activation = useTransform(sectionProgress, [segStart, segEnd], [0, 1])
  const isActive = isInView || false

  return (
    <motion.div ref={cardRef} className="relative group" style={{ opacity: useTransform(activation, [0, 0.5, 1], [0.55, 1, 1]) }}>
      <div className="relative flex flex-col items-center lg:items-start">
        <motion.div
          className={`w-10 h-10 rounded-full border bg-void flex items-center justify-center mb-6 transition-all duration-500 ${
            isActive ? 'border-lime shadow-[0_0_20px_rgba(163,255,18,0.3)]' : 'border-[rgba(124,58,237,0.5)] group-hover:border-violet group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]'
          }`}
          style={{ scale: useTransform(activation, [0, 1], [1, 1.15]) }}
        >
          <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? 'text-lime' : 'text-violet'}`}>{stage.icon}</span>
        </motion.div>

        <div className="font-mono text-[10px] text-dim mb-1 tracking-wider">{stage.num}</div>
        <motion.div
          className={`font-mono text-sm font-semibold mb-3 transition-colors duration-300 ${isActive ? 'text-lime' : 'text-bone'}`}
          style={{ scale: useTransform(activation, [0, 1], [1, 1.06]) }}
        >
          {stage.title}
        </motion.div>
        <p className="font-mono text-xs text-dim leading-relaxed text-center lg:text-left">{stage.desc}</p>

        {/* Stage visual preview */}
        <motion.div
          initial={false}
          animate={{ opacity: isActive ? 1 : 0, height: isActive ? 'auto' : 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden w-full"
        >
          <div className="mt-4 rounded-xl border border-lime/20 bg-lime-dim p-3">
            <div className="font-mono text-[9px] text-lime tracking-wider">{stage.visual}</div>
            <div className="font-mono text-[8px] text-dim mt-1">{stage.vMeta}</div>
          </div>
        </motion.div>
      </div>

      {index < total - 1 && (
        <div className="hidden lg:block absolute top-4 -right-2.5 text-[rgba(124,58,237,0.4)] text-xs z-10">›</div>
      )}
    </motion.div>
  )
}

/* ─── EVIDENCE ENGINE ────────────────────────────────────────────────────── */

function EvidenceEngine() {
  const chain = [
    { label: 'CLAIM', color: 'border-[rgba(124,58,237,0.5)] text-violet', bg: 'bg-[rgba(124,58,237,0.08)]' },
    { label: 'OFFICIAL SOURCE', color: 'border-[rgba(163,255,18,0.4)] text-lime', bg: 'bg-lime-dim' },
    { label: 'INDEPENDENT SOURCE', color: 'border-[rgba(163,255,18,0.3)] text-lime', bg: 'bg-[rgba(163,255,18,0.04)]' },
    { label: 'PUBLIC EVIDENCE', color: 'border-[rgba(245,185,66,0.4)] text-caution', bg: 'bg-[rgba(245,185,66,0.05)]' },
    { label: 'VERIFICATION', color: 'border-[rgba(163,255,18,0.6)] text-lime', bg: 'bg-[rgba(163,255,18,0.08)]' },
  ]
  return (
    <section id="evidence-engine" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          <Reveal>
            <SectionLabel>EVIDENCE ENGINE</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
              AI CAN REASON.<br /><span className="text-soft">IT STILL NEEDS EVIDENCE.</span>
            </h2>
            <p className="font-mono text-sm text-soft leading-relaxed mb-8">
              Trustlify sources every claim against verifiable evidence. The AI reasons over what the evidence shows — it never invents it.
            </p>
            <div className="space-y-2">
              {chain.map((item, i) => (
                <Reveal key={item.label} delay={i * 0.08}>
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 px-4 py-3 rounded-xl border font-mono text-xs tracking-wider ${item.color} ${item.bg}`}>{item.label}</div>
                    {i < chain.length - 1 && <div className="text-dim font-mono text-xs">↓</div>}
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="space-y-4">
              <div className="font-mono text-xs text-dim tracking-wider mb-6">FACT VS INTERPRETATION</div>
              <div className="card-noir p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-lime" />
                  <span className="font-mono text-xs tracking-wider text-lime">FACT</span>
                </div>
                <p className="font-display text-base text-bone leading-relaxed">
                  "The official site lists the application deadline as August 25, 2025."
                </p>
                <div className="mt-3 font-mono text-[10px] text-dim">Source: university.edu.pk · Retrieved Aug 22, 2025</div>
              </div>
              <div className="card-noir p-6 border-[rgba(124,58,237,0.2)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-violet" />
                  <span className="font-mono text-xs tracking-wider text-violet">INTERPRETATION</span>
                </div>
                <p className="font-mono text-sm text-soft leading-relaxed">
                  The circulating post lists August 15 as the deadline. This conflicts with the official source and may reflect an outdated or incorrect version.
                </p>
              </div>
              <div className="card-noir p-4 border-[rgba(245,185,66,0.2)]">
                <div className="flex items-center gap-2">
                  <span className="text-caution text-xs">⚠</span>
                  <span className="font-mono text-xs text-caution">DEADLINE CONFLICT DETECTED</span>
                </div>
                <p className="font-mono text-[11px] text-dim mt-1.5">Post shows Aug 15. Official source shows Aug 25. Verify before acting.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── STUDENT INTELLIGENCE ───────────────────────────────────────────────── */

function StudentIntelligence() {
  const matchFields = [
    { label: 'Education', status: '✓', color: 'text-lime', note: 'BS Computer Science' },
    { label: 'Location', status: '✓', color: 'text-lime', note: 'Pakistan' },
    { label: 'Skills', status: '✓', color: 'text-lime', note: 'Python, Research' },
    { label: 'Experience', status: '?', color: 'text-caution', note: 'Not listed in opportunity' },
    { label: 'Relevance', status: '✓', color: 'text-lime', note: 'STEM field match' },
  ]
  return (
    <section id="for-students" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <Reveal>
            <div className="card-noir-violet p-8 max-w-sm">
              <div className="font-mono text-[10px] tracking-widest text-dim mb-4">DEMO — STUDENT PROFILE MATCH</div>
              <div className="font-mono text-xs text-violet mb-6 tracking-wider">YOUR MATCH</div>
              <div className="space-y-3 mb-6">
                {matchFields.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-bold w-4 ${f.color}`}>{f.status}</span>
                    <span className="font-mono text-xs text-bone flex-1">{f.label}</span>
                    <span className="font-mono text-[10px] text-dim">{f.note}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.06] pt-4">
                <div className="font-mono text-[10px] text-dim mb-1">MATCH STRENGTH</div>
                <div className="font-mono text-lg font-semibold text-lime">LIKELY MATCH</div>
                <p className="font-mono text-[10px] text-dim mt-2 leading-relaxed">
                  You appear likely to meet the listed requirements based on the available information.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SectionLabel>STUDENT INTELLIGENCE</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
              NOT ONLY "IS IT REAL?"<br /><span className="text-soft">ALSO "DOES IT FIT ME?"</span>
            </h2>
            <p className="font-mono text-sm text-soft leading-relaxed">
              Finding the opportunity is only half the problem. Knowing whether it fits you is the other half. Trustlify cross-references your profile against the opportunity's actual requirements — not a binary yes/no, but a nuanced eligibility read.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── CURRENTNESS ────────────────────────────────────────────────────────── */

function CurrentnessSection() {
  const timeline = [
    { label: 'Published', date: 'Mar 2024', note: 'Original post', color: 'bg-dim' },
    { label: 'Updated', date: 'Jul 2024', note: 'Deadline extended', color: 'bg-violet' },
    { label: 'Deadline', date: 'Aug 25, 2024', note: 'Current official', color: 'bg-lime' },
    { label: 'Current Status', date: 'Aug 22, 2025', note: 'EXPIRED', color: 'bg-danger' },
  ]
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <SectionLabel>CURRENTNESS</SectionLabel>
          <h2 className="font-display mb-16" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
            REAL ONCE DOESN'T MEAN<br /><span className="text-soft">CURRENT NOW.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="max-w-3xl">
            <div className="relative">
              <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-[rgba(124,58,237,0.4)] via-[rgba(124,58,237,0.2)] to-[rgba(255,77,94,0.4)]" />
              <div className="space-y-6">
                {timeline.map((item, i) => (
                  <div key={item.label} className="flex items-start gap-6">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${item.color} ring-4 ring-void`} />
                    <div className="flex-1 card-noir p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm text-bone">{item.label}</span>
                        <span className="font-mono text-xs text-dim">{item.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-soft">{item.note}</span>
                        {i === timeline.length - 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(255,77,94,0.1)] border border-[rgba(255,77,94,0.3)] font-mono text-[9px] text-danger">
                            ⚠ EXPIRED OPPORTUNITY
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 card-noir border-[rgba(163,255,18,0.15)] p-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-lime rounded-full flex-shrink-0" />
                <div>
                  <div className="font-mono text-xs text-lime mb-0.5">GENUINE SOURCE · EXPIRED OPPORTUNITY</div>
                  <div className="font-mono text-[11px] text-dim">The organization is legitimate but this specific opportunity closed in 2024. Trustlify flags this before you apply.</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── RISK + ACTION ──────────────────────────────────────────────────────── */

function RiskActionSection() {
  const actions = [
    { text: 'Open the official university website directly (do not use the circulating link).', type: 'primary' as const },
    { text: 'Do not submit CNIC, bank details, or OTP to the linked domain.', type: 'warning' as const },
    { text: 'Confirm the current deadline on the official source.', type: 'secondary' as const },
    { text: 'Save this investigation and set a monitoring alert.', type: 'secondary' as const },
  ]
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          <Reveal>
            <SectionLabel>RISK + ACTION</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
              NOT JUST A VERDICT.<br /><span className="text-soft">CLEAR NEXT STEPS.</span>
            </h2>
            <p className="font-mono text-sm text-soft leading-relaxed">
              A warning without a next step isn't enough. Every Trustlify investigation ends with specific, actionable guidance — not just a score.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card-noir-violet p-6">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">WHAT TO DO NEXT</div>
              <div className="space-y-3">
                {actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`font-mono text-xs flex-shrink-0 mt-0.5 ${action.type === 'warning' ? 'text-danger' : 'text-lime'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`font-mono text-sm ${action.type === 'warning' ? 'text-danger' : 'text-soft'}`}>{action.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── PRIVACY ────────────────────────────────────────────────────────────── */

function PrivacySection() {
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <Reveal>
            <SectionLabel>PRIVACY</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
              VERIFY WITHOUT EXPOSING<br /><span className="text-soft">MORE THAN YOU NEED TO.</span>
            </h2>
            <p className="font-mono text-sm text-soft leading-relaxed">
              Before analysis begins, Trustlify helps you keep sensitive details out of the evidence trail.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card-noir p-6 max-w-sm">
              <div className="font-mono text-[10px] text-dim mb-4 tracking-wider">FICTIONAL DOCUMENT PREVIEW</div>
              <div className="space-y-3">
                {[
                  { label: 'Full Name', value: 'Ahmad Khan', redact: false },
                  { label: 'CNIC', value: '█████ ██████ █', redact: true },
                  { label: 'OTP Code', value: '████', redact: true },
                  { label: 'Bank Info', value: '█████████', redact: true },
                  { label: 'Phone', value: '+92 ██████████', redact: true },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                    <span className="font-mono text-xs text-dim">{f.label}</span>
                    <span className={`font-mono text-xs ${f.redact ? 'text-caution tracking-widest' : 'text-soft'}`}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-lime-dim border border-[rgba(163,255,18,0.15)]">
                <span className="text-lime text-xs">✓</span>
                <span className="font-mono text-[11px] text-lime">REDACT BEFORE ANALYSIS</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─── LOCAL CONTEXT ──────────────────────────────────────────────────────── */

function LocalContextSection() {
  const languages = [
    { lang: 'English', example: 'Is this scholarship genuine?', active: true },
    { lang: 'Urdu', example: 'کیا یہ اسکالرشپ اصلی ہے؟', active: true },
    { lang: 'Roman Urdu', example: 'Ye scholarship genuine hai? deadline kya hai?', active: true },
    { lang: 'Sindhi*', example: 'ڇا هي اسڪالرشپ اصلي آهي؟', active: false },
  ]
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <SectionLabel>LOCAL CONTEXT</SectionLabel>
          <h2 className="font-display mb-16" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
            BUILT FOR HOW PEOPLE<br /><span className="text-soft">ACTUALLY COMMUNICATE HERE.</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {languages.map((item, i) => (
            <Reveal key={item.lang} delay={i * 0.06}>
              <div className={`card-noir p-5 ${item.active ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-medium text-bone">{item.lang}</span>
                  {item.active
                    ? <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                    : <span className="font-mono text-[9px] text-dim">PENDING VALIDATION</span>}
                </div>
                <p className="font-mono text-[11px] text-dim leading-relaxed">{item.example}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <div className="card-noir p-5 border-[rgba(124,58,237,0.2)] max-w-xl">
            <div className="font-mono text-[10px] text-dim mb-2">MIXED-LANGUAGE INPUT EXAMPLE</div>
            <p className="font-display text-base text-bone italic">"Ye scholarship genuine hai? deadline kya hai?"</p>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status="verified" label="ROMAN URDU DETECTED" />
            </div>
          </div>
          <p className="font-mono text-[10px] text-dim mt-4">*Sindhi support will be enabled only after full model validation.</p>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── IMPACT ─────────────────────────────────────────────────────────────── */

function ImpactSection() {
  const stats = [
    { value: '87%', label: 'of Pakistani students encounter dubious opportunities monthly' },
    { value: '10+', label: 'minutes spent on average for manual verification' },
    { value: '3 in 5', label: 'students have applied to fraudulent opportunities' },
    { value: '<18s', label: 'average Trustlify investigation time' },
  ]
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <SectionLabel>IMPACT</SectionLabel>
          <h2 className="font-display mb-16" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
            THE PROBLEM IS MASSIVE.<br /><span className="text-soft">THE SOLUTION SHOULD BE SIMPLE.</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08}>
              <div className="card-noir p-6 text-center">
                <div className="font-display text-4xl text-lime mb-3" style={{ fontWeight: 300 }}>{stat.value}</div>
                <div className="font-mono text-[10px] text-dim leading-relaxed">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── WHY TRUSTLIFY ──────────────────────────────────────────────────────── */

function WhyTrustlify() {
  return (
    <section id="why-trustlify" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <SectionLabel>WHY TRUSTLIFY</SectionLabel>
          <h2 className="font-display mb-16" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
            AN INVESTIGATION PLATFORM.<br /><span className="text-soft">NOT ANOTHER AI CHATBOT.</span>
          </h2>
        </Reveal>
        <div className="grid grid-cols-12 gap-4">
          <Reveal className="col-span-12 lg:col-span-5">
            <div className="card-noir-violet p-8 h-full">
              <div className="w-10 h-10 rounded-xl bg-[rgba(124,58,237,0.2)] flex items-center justify-center mb-4">
                <span className="text-violet text-lg">◎</span>
              </div>
              <h3 className="font-display text-2xl mb-3" style={{ fontWeight: 300 }}>Investigate Anything</h3>
              <p className="font-mono text-sm text-soft leading-relaxed">Links, posts, screenshots, PDFs, jobs, scholarships, internships, courses, hackathons, and more.</p>
            </div>
          </Reveal>
          <Reveal className="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.06}>
            <div className="card-noir p-6 h-full">
              <div className="text-violet text-lg mb-3">⊹</div>
              <h3 className="font-mono text-sm font-semibold mb-2">Evidence-Driven</h3>
              <p className="font-mono text-xs text-dim leading-relaxed">Every verdict is grounded in verifiable sources. AI reasons over evidence, not in place of it.</p>
            </div>
          </Reveal>
          <Reveal className="col-span-12 sm:col-span-6 lg:col-span-3" delay={0.12}>
            <div className="card-noir p-6 h-full">
              <div className="text-caution text-lg mb-3">⚡</div>
              <h3 className="font-mono text-sm font-semibold mb-2">Conflict Detection</h3>
              <p className="font-mono text-xs text-dim leading-relaxed">Mismatches surfaced automatically.</p>
            </div>
          </Reveal>
          {[
            { icon: '◷', title: 'Currentness', desc: 'Expired opportunities flagged.' },
            { icon: '◉', title: 'Student Match', desc: 'Profile eligibility assessment.' },
            { icon: '→', title: 'Actionable Guidance', desc: 'Clear next steps every time.' },
            { icon: '◻', title: 'Privacy First', desc: 'Redact before analysis.' },
          ].map((item, i) => (
            <Reveal key={item.title} className="col-span-6 lg:col-span-3" delay={i * 0.05}>
              <div className="card-noir p-5 h-full">
                <div className="text-soft text-base mb-2">{item.icon}</div>
                <h3 className="font-mono text-xs font-semibold mb-1">{item.title}</h3>
                <p className="font-mono text-[10px] text-dim leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── ABOUT ──────────────────────────────────────────────────────────────── */

function AboutSection() {
  const statementRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: statementScroll } = useScroll({
    target: statementRef,
    offset: ['start end', 'end start'],
  } as UseScrollOptions)
  const line1Y = useTransform(statementScroll, [0.15, 0.35], [40, 0])
  const line1Opacity = useTransform(statementScroll, [0.15, 0.3], [0, 1])
  const line2Y = useTransform(statementScroll, [0.25, 0.45], [40, 0])
  const line2Opacity = useTransform(statementScroll, [0.25, 0.4], [0, 1])
  const evidenceWidth = useTransform(statementScroll, [0.35, 0.55], ['0%', '82%'])
  const fragmentOpacity = useTransform(statementScroll, [0.5, 0.6], [0, 1])

  const items = [
    { label: 'MISSION', text: 'Trustlify exists to help people — especially students navigating complex online environments — make informed decisions grounded in evidence, not guesses.' },
    { label: 'EVIDENCE-FIRST PHILOSOPHY', text: 'We believe AI should surface and reason over evidence, not replace it. Every verdict Trustlify issues is traceable to a source you can verify yourself.' },
    { label: 'HOW AI IS USED', text: 'The AI extracts claims, identifies relevant sources, detects conflicts, and reasons about what the evidence means. It does not fabricate information or present interpretation as fact.' },
    { label: 'RESPONSIBLE BOUNDARIES', text: 'Trustlify states clearly when evidence is insufficient. It distinguishes facts from interpretations. It labels demo content explicitly. It does not create false certainty.' },
    { label: 'STUDENT IMPACT', text: 'Students in Pakistan and similar contexts encounter a disproportionate volume of dubious opportunities. Trustlify is designed to close that information asymmetry.' },
  ]

  return (
    <section id="about" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Editorial motion statement ── */}
        <div ref={statementRef} className="mb-24 py-16">
          <div className="max-w-4xl">
            <motion.div style={{ y: line1Y, opacity: line1Opacity }}>
              <h2 className="font-display leading-[0.92]" style={{ fontSize: 'clamp(40px,5.5vw,80px)', fontWeight: 300 }}>
                AI can reason.
              </h2>
            </motion.div>
            <motion.div style={{ y: line2Y, opacity: line2Opacity }} className="mt-4">
              <h2 className="font-display leading-[0.92] text-soft" style={{ fontSize: 'clamp(40px,5.5vw,80px)', fontWeight: 300 }}>
                It still needs something<br />to reason from.
              </h2>
            </motion.div>
            <div className="mt-8 relative h-px bg-white/[0.06]">
              <motion.div className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet to-lime" style={{ width: evidenceWidth }} />
            </div>
            <motion.div style={{ opacity: fragmentOpacity }} className="mt-6 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-lime" />
              <span className="font-mono text-[10px] text-dim tracking-wider">SOURCE: university.edu.pk · Retrieved Aug 22, 2025</span>
            </motion.div>
          </div>
        </div>

        {/* ── Existing content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <Reveal className="lg:col-span-5">
            <SectionLabel>ABOUT</SectionLabel>
            <h2 className="font-display mb-6" style={{ fontSize: 'clamp(32px,3.5vw,54px)', fontWeight: 300 }}>
              TRUST SHOULD BE EARNED<br /><span className="text-soft">THROUGH EVIDENCE.</span>
            </h2>
          </Reveal>
          <div className="lg:col-span-7 space-y-6">
            {items.map((item, i) => (
              <Reveal key={item.label} delay={i * 0.06}>
                <div className="border-t border-white/[0.06] pt-6">
                  <div className="font-mono text-[10px] text-violet tracking-wider mb-2">{item.label}</div>
                  <p className="font-mono text-sm text-soft leading-relaxed">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── FINAL CTA ──────────────────────────────────────────────────────────── */

function FinalCTA({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="py-40 border-t border-white/[0.06] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <Reveal>
          <div className="font-mono text-xs tracking-[0.25em] text-dim mb-6">SEE SOMETHING UNCERTAIN?</div>
          <h2 className="font-display mb-6 leading-none" style={{ fontSize: 'clamp(56px,8vw,120px)', fontWeight: 300 }}>
            INVESTIGATE IT.
          </h2>
          <p className="font-mono text-sm text-soft mb-10 max-w-md mx-auto">One claim. Multiple sources. One accountable decision.</p>
          <Button variant="lime" size="lg" onClick={() => navigate('/investigate')}>
            INVESTIGATE SOMETHING →
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <TrustlifyLogo size={5} />
          <span className="font-mono text-xs text-dim">TRUSTLIFY · Evidence-Driven Investigation</span>
        </div>
        <div className="font-mono text-[10px] text-dim">© 2025 Trustlify. Prototype only — not production software.</div>
      </div>
    </footer>
  )
}

/* ─── LANDING PAGE EXPORT ────────────────────────────────────────────────── */

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-void text-bone">
      <MarketingHeader />
      <CinematicEvidenceHero navigate={navigate} />
      <ProblemSection />
      <HowItWorks />
      <EvidenceEngine />
      <StudentIntelligence />
      <CurrentnessSection />
      <RiskActionSection />
      <PrivacySection />
      <LocalContextSection />
      <ImpactSection />
      <WhyTrustlify />
      <AboutSection />
      <FinalCTA navigate={navigate} />
      <Footer />
    </div>
  )
}
