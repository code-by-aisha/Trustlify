/**
 * HeroPointerController — mouse-based camera depth effect.
 *
 * Normalises cursor position to –1 → +1, then exposes 4 depth tiers
 * (bg / far / mid / fg) as spring-smoothed MotionValues (px).
 *
 * Amplitudes from the brief:
 *   background  2 px
 *   far objects 4 px
 *   mid objects 7 px
 *   foreground 10 px
 */
import { useEffect } from 'react'
import { useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import type { MotionValue } from 'framer-motion'

export interface HeroPointerValues {
  bgX: MotionValue<number>
  bgY: MotionValue<number>
  farX: MotionValue<number>
  farY: MotionValue<number>
  midX: MotionValue<number>
  midY: MotionValue<number>
  fgX: MotionValue<number>
  fgY: MotionValue<number>
  /** Raw normalised values –1…+1, useful for rotation effects */
  rawX: MotionValue<number>
  rawY: MotionValue<number>
}

const AMP = { bg: 2, far: 4, mid: 7, fg: 10 } as const

export function useHeroPointer(): HeroPointerValues {
  const reduced = useReducedMotion()

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  // Spring-smoothed versions for each tier
  const springOpts = { stiffness: 120, damping: 20, mass: 0.4 }
  const sX = useSpring(rawX, springOpts)
  const sY = useSpring(rawY, springOpts)

  const bgX  = useTransform(sX, (v) => (reduced ? 0 : v * AMP.bg))
  const bgY  = useTransform(sY, (v) => (reduced ? 0 : v * AMP.bg))
  const farX = useTransform(sX, (v) => (reduced ? 0 : v * AMP.far))
  const farY = useTransform(sY, (v) => (reduced ? 0 : v * AMP.far))
  const midX = useTransform(sX, (v) => (reduced ? 0 : v * AMP.mid))
  const midY = useTransform(sY, (v) => (reduced ? 0 : v * AMP.mid))
  const fgX  = useTransform(sX, (v) => (reduced ? 0 : v * AMP.fg))
  const fgY  = useTransform(sY, (v) => (reduced ? 0 : v * AMP.fg))

  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        rawX.set((e.clientX / window.innerWidth - 0.5) * 2)
        rawY.set((e.clientY / window.innerHeight - 0.5) * 2)
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [rawX, rawY])

  return { bgX, bgY, farX, farY, midX, midY, fgX, fgY, rawX, rawY }
}
