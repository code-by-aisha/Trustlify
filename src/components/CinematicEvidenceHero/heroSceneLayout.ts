/**
 * heroSceneLayout — how large the cinematic stage draws its floating layers.
 *
 * The hero is ONE composition at every size: post cards sweep through the first
 * half of the scroll, the evidence tree assembles in the second half, the verdict
 * card closes it. What changes with the viewport is only (a) how big each layer is
 * drawn — the numbers below — and (b) where it is anchored — `lg:` classes on each
 * element, which hold the desktop positions from `lg` up. A phone therefore shows
 * the same scene drawn smaller, not a different scene.
 *
 * Design sizes are the ones the composition was laid out against: a 300px post
 * card, a 180px tree chip, a 300px verdict card, in a 1440x900 stage.
 */
import { useMemo, useSyncExternalStore } from 'react'

export interface HeroSceneScale {
  /** Post card size, relative to its design size. */
  card: number
  /** Multiplier on the distance a card flies in and past the viewer (design px). */
  flight: number
  /** Evidence-tree chip size, relative to its design size. */
  node: number
  /** Verdict card size, relative to its design size. */
  verdict: number
  /** True from `lg` up, where the stage has a column of its own for the scene. */
  wide: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Fallback for the first pass on a server / non-measurable environment. */
const DESKTOP: HeroSceneScale = { card: 1, flight: 1, node: 1, verdict: 1, wide: true }

/**
 * The maths, for the sizes that matter:
 *   1440x900  card 1.00 (150→300px wide)  flight 1.00  node 1.00
 *   1024x768  card 0.80                   flight 0.78  node 0.86
 *    768x1024 card 0.66                   flight 0.44  node 0.88
 *    390x844  card 0.55 (→167px wide)     flight 0.36  node 0.81
 *    320x568  card 0.42                   flight 0.28  node 0.68
 *
 * Below `lg` height is capped against 1150 because the stage has to share one
 * column with the heading: a shorter viewport has less room for the scene, so the
 * cards shrink further rather than the text.
 */
export function heroSceneScaleFor(w: number, h: number): HeroSceneScale {
  if (w >= 1280) return DESKTOP

  if (w >= 1024) {
    const k = clamp(w / 1280, 0.74, 0.94)
    return {
      card: k,
      flight: clamp(k - 0.02, 0.7, 0.92),
      node: clamp(k + 0.06, 0.8, 1),
      verdict: k,
      wide: true,
    }
  }

  const k = clamp(Math.min(w / 700, h / 1150), 0.4, 0.72)
  return {
    card: k,
    /* Flights are shorter than the cards themselves: on a 390px stage a card that
     * travels a full 520px spends most of its entrance off-screen. */
    flight: clamp(k * 0.66, 0.26, 0.5),
    /* The tree carries the readable half of the story, so it is allowed to stay
     * comparatively large — a chip drawn at 0.55 of 180px is still legible. */
    node: clamp(k + 0.26, 0.62, 0.88),
    /* Anchored to the top-right corner below `lg`, where the heading is not. */
    verdict: clamp(k - 0.02, 0.42, 0.6),
    wide: false,
  }
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

/** Quantised to whole pixels so a scroll-driven layout shift cannot re-render. */
function readViewport() {
  if (typeof window === 'undefined') return '0x0'
  return `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
}

export function useHeroSceneScale(): HeroSceneScale {
  const viewport = useSyncExternalStore(subscribe, readViewport, () => '0x0')
  return useMemo(() => {
    if (viewport === '0x0') return DESKTOP
    const [w, h] = viewport.split('x').map(Number)
    return heroSceneScaleFor(w, h)
  }, [viewport])
}
