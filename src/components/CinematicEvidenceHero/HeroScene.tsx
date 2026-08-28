import { useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { HeroArtifactSequence } from './HeroArtifactSequence'
import { InstagramArtifact, WhatsAppArtifact } from './HeroArtifacts'
import { HeroDecision } from './HeroDecision'
import { HeroNetwork } from './HeroNetwork'
import { HeroOrbitalSphere } from './HeroOrbitalSphere'
import { useHeroPointer } from './HeroPointerController'
import { PHASE_LABELS, PHASE_MIDPOINTS, useHeroScroll } from './HeroScrollController'
import { HeroTypography } from './HeroTypography'

function AmbientParticles() {
  const dots = Array.from({ length: 38 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 100}%`,
    top: `${(i * 29 + 11) % 100}%`,
    size: i % 9 === 0 ? 3 : i % 4 === 0 ? 2 : 1,
    delay: `${(i % 11) * 0.32}s`,
  }))
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {dots.map((dot) => (
        <span
          key={dot.id}
          className="hero-star absolute rounded-full"
          style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size, animationDelay: dot.delay }}
        />
      ))}
    </div>
  )
}

/* ─── Phase timeline — labels to the LEFT of dots so they never clip ──────── */

function PhaseTimeline({ progress }: { progress: number }) {
  const activeIndex = PHASE_MIDPOINTS.reduce((closest, point, i) => (
    Math.abs(progress - point) < Math.abs(progress - PHASE_MIDPOINTS[closest]) ? i : closest
  ), 0)

  return (
    <div
      className="absolute right-[4%] top-1/2 z-50 hidden -translate-y-1/2 items-center xl:flex"
      aria-hidden="true"
    >
      {/* Labels column — to the LEFT of the dots */}
      <div className="flex flex-col items-end mr-3">
        {PHASE_LABELS.map((label, i) => {
          const active = i === activeIndex
          return (
            <span
              key={label}
              className={`font-mono text-[9px] tracking-[0.18em] leading-[42px] transition-colors ${
                active ? 'text-lime' : 'text-dim'
              }`}
            >
              {label}
            </span>
          )
        })}
      </div>

      {/* Dots + line column */}
      <div className="relative h-[294px] w-px bg-white/15">
        <motion.div
          className="absolute left-0 top-0 w-px bg-gradient-to-b from-violet via-violet to-lime"
          style={{ height: `${Math.max(6, progress * 100)}%` }}
        />
        {PHASE_LABELS.map((label, i) => {
          const top = `${(i / (PHASE_LABELS.length - 1)) * 100}%`
          const active = i === activeIndex
          return (
            <div
              key={label}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ top }}
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full ring-4 ring-void transition-all ${
                  active ? 'bg-lime shadow-[0_0_22px_rgba(163,255,18,0.8)]' : 'bg-soft/60'
                }`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Mobile / tablet evidence preview ─────────────────────────────────────
 * Uses fixed-size overflow wrappers instead of raw scale transforms:
 * a CSS scale does not shrink the layout box, which previously made the
 * stacked mobile column taller than the viewport and pushed the heading
 * off-screen inside the clipped sticky stage.
 * ───────────────────────────────────────────────────────────────────────── */

function ScaledPost({ w, h, scale, className = '', children }: {
  w: number; h: number; scale: number; className?: string; children: ReactNode
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: w, height: h }} aria-hidden="true">
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

function MobileEvidencePreview() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-start justify-end gap-4 px-4 lg:hidden" aria-hidden="true">
      {/* Instagram — primary post, always visible */}
      <ScaledPost w={156} h={250} scale={0.52}>
        <InstagramArtifact />
      </ScaledPost>
      {/* WhatsApp — secondary, tablet only */}
      <div className="hidden sm:block">
        <ScaledPost w={140} h={200} scale={0.48} className="mt-10">
          <WhatsAppArtifact />
        </ScaledPost>
      </div>
    </div>
  )
}

/* ─── Main hero scene ─────────────────────────────────────────────────────── */

export function HeroScene({ navigate }: { navigate: (path: string) => void }) {
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const pointer = useHeroPointer()
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end end'] })
  const values = useHeroScroll(scrollYProgress)
  const [progress, setProgress] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', setProgress)

  const sceneScale = useTransform(values.sceneRecede, [0, 1], [1, 0.92])
  const sceneOpacity = useTransform(values.sceneRecede, [0, 1], [1, 0.7])

  return (
    <section ref={heroRef} id="hero" className={`relative ${reduced ? 'min-h-screen' : 'min-h-[400vh]'}`}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden bg-void pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,rgba(124,58,237,0.12),transparent_60%),linear-gradient(180deg,rgba(10,10,15,0)_0%,#0A0A0F_100%)]" />

        {/* Ambient particles */}
        <motion.div className="absolute inset-0" style={{ y: values.parallaxBg, x: pointer.bgX }}>
          <AmbientParticles />
        </motion.div>

        {/* Orbital sphere — present from the very start */}
        <HeroOrbitalSphere
          opacity={values.sphereOpacity}
          scale={values.sphereScale}
          x={pointer.bgX}
          y={pointer.bgY}
        />

        {/* Scene layers (recede at the end, 3D perspective for artifacts) */}
        <motion.div
          className="absolute inset-0"
          style={{
            scale: sceneScale,
            opacity: sceneOpacity,
            perspective: '1400px',
          }}
        >
          <HeroArtifactSequence values={values} pointer={pointer} />
          <HeroNetwork values={values} pointer={pointer} />
          <HeroDecision values={values} pointer={pointer} />
        </motion.div>

        {/* Content grid */}
        <div className="relative z-30 mx-auto grid w-full max-w-7xl grid-cols-1 items-center px-4 sm:px-6 py-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 lg:py-24">
          <HeroTypography values={values} navigate={navigate} />
          <div className="hidden h-[660px] lg:block" aria-hidden="true" />
        </div>

        {/* Mobile / tablet posts — pinned to the stage so they never overflow the bottom edge */}
        <MobileEvidencePreview />

        {/* Phase timeline — labels on left side, dots on right, safe from clipping */}
        <PhaseTimeline progress={progress} />
      </div>
    </section>
  )
}
