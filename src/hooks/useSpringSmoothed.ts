/**
 * useSpringSmoothed — wraps a MotionValue with a spring for buttery interpolation.
 * Used by the pointer controller to smooth mouse position across depth tiers.
 */
import { useEffect, useRef } from 'react'
import { useSpring, useTransform, type MotionValue } from 'framer-motion'

/**
 * Returns a spring-smoothed version of the given MotionValue.
 * `stiffness` and `damping` control the feel.
 */
export function useSpringSmoothed(
  source: MotionValue<number>,
  stiffness = 150,
  damping = 20
): MotionValue<number> {
  const springRef = useRef<ReturnType<typeof useSpring> | null>(null)
  if (!springRef.current) {
    springRef.current = useSpring(source, { stiffness, damping, mass: 0.5 })
  }
  useEffect(() => {
    const unsubscribe = source.on('change', (v) => {
      springRef.current?.set(v)
    })
    return unsubscribe
  }, [source])
  return springRef.current
}

/**
 * Maps a source MotionValue through a transform function and wraps it in a spring.
 */
export function useSpringTransform(
  source: MotionValue<number>,
  fn: (v: number) => number,
  stiffness = 150,
  damping = 20
): MotionValue<number> {
  const mapped = useTransform(source, fn)
  return useSpringSmoothed(mapped, stiffness, damping)
}
