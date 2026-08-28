/**
 * HeroArtifactSequence — 3D gallery-style sequential artifact choreography.
 *
 * Each artifact enters the viewport from distance, grows toward the viewer,
 * reaches sharp focus, then exits past the viewer with blur + scale.
 * At most 1 artifact is in focus at any scroll position.
 *
 * Cycle: ENTER (far, blurred, small) → APPROACH → FOCUS (sharp, full-size) → EXIT (past viewer, large, blurred)
 *
 * The whole sequence lives inside scroll 0.04 → 0.62 — the evidence graph
 * only begins forming after every post has passed.
 */
import { motion, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'
import type { HeroPointerValues } from './HeroPointerController'
import type { HeroScrollValues } from './HeroScrollController'
import {
  InstagramArtifact,
  LinkedInArtifact,
  PosterArtifact,
  WhatsAppArtifact,
} from './HeroArtifacts'

/* ─── Single artifact with 3D gallery lifecycle ───────────────────────────── */

interface LifecycleProps {
  children: ReactNode
  raw: MotionValue<number>
  /** [enterStart, enterEnd, exitStart, exitEnd] — scrollYProgress range */
  timing: [number, number, number, number]
  /** CSS positioning for the focus position */
  className: string
  enterOffset: { x: number; y: number }
  exitOffset: { x: number; y: number }
  /** 3D rotation during enter/exit */
  rotateEnter: { y: number; x: number }
  rotateExit: { y: number; x: number }
  depth: 'far' | 'mid' | 'fg'
  pointer: HeroPointerValues
}

function ArtifactLifecycle({
  children, raw, timing, className, enterOffset, exitOffset, rotateEnter, rotateExit, depth, pointer,
}: LifecycleProps) {
  const [eStart, eEnd, xStart, xEnd] = timing

  // Opacity: trapezoidal fade
  const opacity = useTransform(raw, [eStart, eEnd, xStart, xEnd], [0, 1, 1, 0])

  // Scale: start small (distant), full at focus, grow past viewer on exit
  const scale = useTransform(raw, [eStart, eEnd, xStart, xEnd], [0.45, 1, 1, 1.22])

  // Position: enter from offset, focus at origin, exit past viewer
  const x = useTransform(raw, [eStart, eEnd, xStart, xEnd], [enterOffset.x, 0, 0, exitOffset.x])
  const y = useTransform(raw, [eStart, eEnd, xStart, xEnd], [enterOffset.y, 0, 0, exitOffset.y])

  // Blur: heavy on enter (distant), sharp at focus, heavy on exit (past viewer)
  const blurPx = useTransform(raw, [eStart, eEnd, xStart, xEnd], [12, 0, 0, 14])
  const filter = useTransform(blurPx, (v: number) => `blur(${v}px)`)

  // 3D rotation: tilt during enter, straighten at focus, tilt opposite on exit
  const rotateY = useTransform(raw, [eStart, eEnd, xStart, xEnd], [rotateEnter.y, 0, 0, rotateExit.y])
  const rotateX = useTransform(raw, [eStart, eEnd, xStart, xEnd], [rotateEnter.x, 0, 0, rotateExit.x])

  // Mouse parallax
  const px = depth === 'fg' ? pointer.fgX : depth === 'mid' ? pointer.midX : pointer.farX
  const py = depth === 'fg' ? pointer.fgY : depth === 'mid' ? pointer.midY : pointer.farY

  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      style={{
        opacity,
        scale,
        x,
        y,
        filter,
        rotateY,
        rotateX,
      }}
      aria-hidden="true"
    >
      <motion.div style={{ x: px, y: py }}>
        {children}
      </motion.div>
    </motion.div>
  )
}

/* ─── Sequence ─────────────────────────────────────────────────────────────── */

export function HeroArtifactSequence({
  values,
  pointer,
}: {
  values: HeroScrollValues
  pointer: HeroPointerValues
}) {
  const raw = values.raw

  return (
    <div
      className="absolute inset-0 hidden lg:block pointer-events-none overflow-hidden"
      style={{ perspective: '1200px' }}
      aria-hidden="true"
    >
      {/* 1 — Instagram: enters from right-far, sweeps toward viewer, exits upper-left */}
      <ArtifactLifecycle
        raw={raw}
        timing={[0.04, 0.11, 0.17, 0.22]}
        className="left-[46%] top-[14%]"
        enterOffset={{ x: 520, y: 40 }}
        exitOffset={{ x: -380, y: -200 }}
        rotateEnter={{ y: -12, x: 4 }}
        rotateExit={{ y: 8, x: -6 }}
        depth="mid"
        pointer={pointer}
      >
        <InstagramArtifact />
      </ArtifactLifecycle>

      {/* 2 — LinkedIn: enters from left-far, approaches, exits right-past-viewer */}
      <ArtifactLifecycle
        raw={raw}
        timing={[0.21, 0.28, 0.33, 0.38]}
        className="left-[48%] top-[18%]"
        enterOffset={{ x: -480, y: 80 }}
        exitOffset={{ x: 420, y: -180 }}
        rotateEnter={{ y: 10, x: -3 }}
        rotateExit={{ y: -10, x: 5 }}
        depth="mid"
        pointer={pointer}
      >
        <LinkedInArtifact />
      </ArtifactLifecycle>

      {/* 3 — Poster: enters from bottom-right far, rises through focus, exits upper-left */}
      <ArtifactLifecycle
        raw={raw}
        timing={[0.36, 0.43, 0.47, 0.52]}
        className="left-[50%] top-[20%]"
        enterOffset={{ x: 200, y: 350 }}
        exitOffset={{ x: -350, y: -220 }}
        rotateEnter={{ y: -6, x: 8 }}
        rotateExit={{ y: 6, x: -8 }}
        depth="fg"
        pointer={pointer}
      >
        <PosterArtifact />
      </ArtifactLifecycle>

      {/* 4 — WhatsApp: enters from right, passes close, exits left-past-viewer.
          Fully gone before the CLAIM node appears (0.58). */}
      <ArtifactLifecycle
        raw={raw}
        timing={[0.48, 0.53, 0.555, 0.58]}
        className="left-[50%] top-[16%]"
        enterOffset={{ x: 460, y: 60 }}
        exitOffset={{ x: -440, y: -160 }}
        rotateEnter={{ y: -8, x: 3 }}
        rotateExit={{ y: 10, x: -4 }}
        depth="fg"
        pointer={pointer}
      >
        <WhatsAppArtifact />
      </ArtifactLifecycle>
    </div>
  )
}
