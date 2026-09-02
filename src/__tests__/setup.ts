/**
 * Trustlify Frontend — shared test environment patches
 *
 * jsdom has no IntersectionObserver or ResizeObserver, and both are touched by
 * the hero: reveal-on-scroll in the flow story, scroll-linked measurement in the
 * pinned stage. Recording what is observed keeps them inert rather than absent,
 * so a component that reaches for them renders instead of throwing.
 */

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

const g = globalThis as unknown as Record<string, unknown>

if (!g.IntersectionObserver) g.IntersectionObserver = StubObserver
if (!g.ResizeObserver) g.ResizeObserver = StubObserver

export {}
