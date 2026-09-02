/**
 * Trustlify Frontend — hero composition tests
 *
 * The reported bug: the cinematic stage was a desktop-only construction. Below `lg`
 * its post gallery and evidence tree were switched off with `display: none` and
 * replaced by a static preview card — so a phone showed one Instagram post parked
 * behind the buttons from the first frame (never arriving, never leaving) and no
 * evidence graph at all, while the headings kept swapping because that layer was
 * never gated.
 *
 * The rule that prevents it: the hero is ONE composition at every size. Nothing in
 * the scene is display-gated; only how large each layer is drawn, and where it is
 * anchored, changes. So these tests assert presence and count at every viewport,
 * and that the desktop geometry is still the one the scene was designed against.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, act } from '@testing-library/react'
import { HeroScene } from '@/components/CinematicEvidenceHero/HeroScene'
import { heroSceneScaleFor } from '@/components/CinematicEvidenceHero/heroSceneLayout'

/* ─── A window the stage can measure ──────────────────────────────────────────
 * jsdom ships no matchMedia (framer-motion asks for prefers-reduced-motion) and
 * reports a fixed viewport. Both are set per test, and `resize` is dispatched the
 * way a browser would, so the stage reacts to a real viewport change.
 */

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      /* Nothing applies: the animated composition is the one under test. */
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  setViewport(1440, 900)
})

afterEach(cleanup)

const navigate = () => {}

/* ─── The parts of the scene that must exist at every size ──────────────────── */

const sceneGroup = (c: HTMLElement) => c.querySelector<HTMLElement>('#hero [data-hero-scene]')
const gallery = (c: HTMLElement) => c.querySelector<HTMLElement>('#hero [data-scene-scale]')
const tree = (c: HTMLElement) => c.querySelector<HTMLElement>('#hero [data-node-scale]')
const postCards = (c: HTMLElement) => c.querySelectorAll('#hero [data-scene-scale] [class*="lg:left-"]')
const treeChips = (c: HTMLElement) => c.querySelectorAll('#hero [data-node-scale] [class*="lg:left-"]')
const verdictCard = (c: HTMLElement) => c.querySelector<HTMLElement>('#hero [class*="rounded-[26px]"]')
const posts = (c: HTMLElement) => c.querySelectorAll('#hero img')

const scaleOf = (el: HTMLElement | null) => Number(el?.getAttribute('data-scene-scale') ?? el?.getAttribute('data-node-scale'))

const TREE_LABELS = [
  'CLAIM', 'OFFICIAL SOURCE', 'INDEPENDENT SOURCE', 'EVIDENCE',
  'CONFLICT DETECTED', 'VERIFIER', 'DECISION',
] as const

/** Design positions the scene was laid out against — held from `lg` up. */
const DESKTOP_ANCHORS = [
  'lg:left-[46%]', 'lg:left-[48%]', 'lg:left-[50%]',                       /* post cards   */
  'lg:left-[36%]', 'lg:left-[24%]', 'lg:left-[52%]', 'lg:left-[35%]',       /* tree chips   */
  'lg:bottom-[5%]', 'lg:right-[5%]',                                        /* verdict card */
] as const

const VIEWPORTS = [
  ['phone', 390, 844],
  ['small phone', 320, 568],
  ['tablet portrait', 820, 1180],
  ['tablet landscape', 1024, 768],
  ['laptop', 1280, 800],
  ['desktop', 1440, 900],
] as const

describe.each(VIEWPORTS)('hero on a %s (%dx%d)', (_name, width, height) => {
  beforeEach(() => setViewport(width, height))

  it('mounts the gallery, the evidence tree and the verdict card', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(sceneGroup(container)).not.toBeNull()
    expect(gallery(container)).not.toBeNull()
    expect(tree(container)).not.toBeNull()
    expect(verdictCard(container)).not.toBeNull()
  })

  it('switches no part of the scene off with display', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    const gated = [...container.querySelectorAll<HTMLElement>('#hero [data-hero-scene] [class]')]
      .filter((el) => el.classList.contains('hidden'))
    /* A hidden layer measures zero, its scroll driver reports NaN for the whole
     * range, and its layers keep whatever transform they were last given. */
    expect(gated.map((el) => el.className)).toEqual([])
  })

  it('shows the four posts of the story, and only those', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(postCards(container)).toHaveLength(4)
    /* Four images, one per post the stages are about. A fifth would be a static
     * preview parked outside the choreography — the original defect. */
    expect(posts(container)).toHaveLength(4)
  })

  it('carries all seven nodes of the evidence chain', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(treeChips(container)).toHaveLength(7)
    const text = container.textContent ?? ''
    for (const label of TREE_LABELS) expect(text).toContain(label)
  })

  it('keeps the pinned stage and the scroll distance that drives it', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(container.querySelectorAll('#hero')).toHaveLength(1)
    expect(container.querySelector('#hero.min-h-\\[400vh\\], #hero .min-h-\\[400vh\\]')).not.toBeNull()
  })

  it('shows the supporting line without a reserved band of empty stage', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    const description = [...container.querySelectorAll('#hero p')]
      .find((p) => p.textContent?.includes('Trustlify investigates'))
    expect(description).toBeDefined()
    expect((description as HTMLElement).classList.contains('hidden')).toBe(false)
    /* The phases swap over the first phase, which sizes the block in flow — so no
     * fixed height reserves a gap that the headline does not fill. */
    expect(container.querySelector('.min-h-\\[220px\\]')).toBeNull()
    expect(container.querySelector('.min-h-\\[280px\\]')).toBeNull()
  })

  it('keeps the desktop positions in the scene, overridden below lg', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    const html = container.innerHTML
    for (const anchor of DESKTOP_ANCHORS) {
      expect(html).toContain(anchor)
    }
  })
})

/* ─── The desktop stage is the one that was already right ─────────────────── */

describe('desktop stage is drawn at design size', () => {
  it('applies no scale to any scene layer at 1440x900', () => {
    setViewport(1440, 900)
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(scaleOf(gallery(container))).toBe(1)
    expect(scaleOf(tree(container))).toBe(1)
  })

  it('puts the verdict card in the bottom right corner', () => {
    setViewport(1440, 900)
    const { container } = render(<HeroScene navigate={navigate} />)
    const card = verdictCard(container)?.closest<HTMLElement>('[class*="lg:bottom-"]')
    expect(card?.className).toContain('lg:bottom-[5%]')
    expect(card?.className).toContain('lg:right-[5%]')
  })
})

/* ─── Small screens get the same scene, drawn smaller ─────────────────────── */

describe('phone stage keeps the scene and shrinks it', () => {
  beforeEach(() => setViewport(390, 844))

  it('draws the cards and chips smaller without rebuilding them', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(scaleOf(gallery(container))).toBeGreaterThan(0.4)
    expect(scaleOf(gallery(container))).toBeLessThan(0.75)
    expect(scaleOf(tree(container))).toBeGreaterThan(scaleOf(gallery(container)))
  })

  it('anchors the scene inside a narrow stage', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    /* Below lg every anchor is a phone one; nothing may reach past ~two thirds of
     * the stage, which is where a scaled card or chip would run off the edge. */
    for (const el of [...postCards(container), ...treeChips(container)]) {
      const left = [...el.classList].find((c) => /^left-\[\d+(?:\.\d+)?%\]$/.test(c))
      expect(left, el.className).toBeDefined()
      expect(Number(/[\d.]+/.exec(left as string)?.[0])).toBeLessThan(56)
    }
  })

  it('moves the verdict card to a corner the buttons do not hold', () => {
    const { container } = render(<HeroScene navigate={navigate} />)
    const card = verdictCard(container)?.closest<HTMLElement>('[class*="bottom-auto"]')
    expect(card?.classList.contains('bottom-auto')).toBe(true)
    /* Cleared in px: the fixed header it has to miss is 64px tall at every size. */
    expect(card?.classList.contains('top-[84px]')).toBe(true)
  })
})

/* ─── The measured scale itself ───────────────────────────────────────────── */

describe('heroSceneScaleFor', () => {
  it('leaves the desktop composition untouched from xl up', () => {
    for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]] as const) {
      expect(heroSceneScaleFor(w, h)).toEqual({ card: 1, flight: 1, node: 1, verdict: 1, wide: true })
    }
  })

  it('shrinks the scene as the stage shrinks, and never past legibility', () => {
    const sizes = [[320, 568], [390, 844], [820, 1180], [1024, 768], [1280, 800]] as const
    const scale = sizes.map(([w, h]) => heroSceneScaleFor(w, h))

    for (const s of scale) {
      expect(s.card).toBeGreaterThanOrEqual(0.4)
      expect(s.node).toBeGreaterThanOrEqual(0.62)
      expect(s.verdict).toBeGreaterThanOrEqual(0.42)
      expect(s.card).toBeLessThanOrEqual(1)
    }
    /* Monotonic: a wider stage never draws the scene smaller. */
    for (let i = 1; i < scale.length; i += 1) {
      expect(scale[i].card).toBeGreaterThanOrEqual(scale[i - 1].card)
      expect(scale[i].flight).toBeGreaterThanOrEqual(scale[i - 1].flight)
    }
    expect(scale[0].wide).toBe(false)
    expect(scale[scale.length - 1].wide).toBe(true)
  })

  it('shortens the flights so an entrance is not spent off-screen', () => {
    expect(heroSceneScaleFor(390, 844).flight).toBeLessThan(heroSceneScaleFor(1440, 900).flight)
    expect(heroSceneScaleFor(390, 844).flight).toBeLessThan(0.55)
  })

  it('gives a shorter viewport a smaller scene, not a clipped one', () => {
    expect(heroSceneScaleFor(390, 600).card).toBeLessThan(heroSceneScaleFor(390, 1000).card)
  })
})

/* ─── Resizing must not swap one scene for another ────────────────────────── */

describe('resizing across the breakpoints', () => {
  it('redraws the same scene instead of leaving a stale layer behind', async () => {
    setViewport(1440, 900)
    const { container } = render(<HeroScene navigate={navigate} />)
    expect(scaleOf(gallery(container))).toBe(1)

    await act(async () => {
      setViewport(390, 844)
      window.dispatchEvent(new Event('resize'))
    })
    expect(container.querySelectorAll('#hero')).toHaveLength(1)
    expect(scaleOf(gallery(container))).toBeLessThan(1)
    expect(postCards(container)).toHaveLength(4)
    expect(treeChips(container)).toHaveLength(7)
    expect(posts(container)).toHaveLength(4)

    await act(async () => {
      setViewport(1440, 900)
      window.dispatchEvent(new Event('resize'))
    })
    expect(scaleOf(gallery(container))).toBe(1)
    expect(treeChips(container)).toHaveLength(7)
  })
})
