/**
 * HeroNetwork — the evidence tree that assembles as the user scrolls.
 *
 * One composition, two coordinate tables. `stage` holds the desktop geometry the
 * scene was designed against (and is used from `lg` up); `stack` is the same tree
 * with its columns brought inside a phone-width stage and its rows spaced for a
 * single column. Both are percentages of the same box, so the tree is always present
 * — nothing about it is switched off below a breakpoint.
 *
 * Chips are drawn at `node` of their design size: an artwork scaled down keeps its
 * type, padding and rounding in proportion, which a rebuilt small variant would not.
 *
 * The tree is laid out inside a box inset from the top of the stage rather than
 * across all of it. The layer drifts up to 70px upward as the scroll closes, so a
 * stage-height box pulled the CLAIM node behind the fixed header and cut the bottom
 * row short. Every number below — anchors, path coordinates, dots — is a percentage
 * of that same box, so insetting it moves and settles the whole tree together and
 * leaves each connector welded to the nodes it joins.
 */
import { motion, useTransform } from 'framer-motion'
import type { HeroPointerValues } from './HeroPointerController'
import type { HeroScrollValues } from './HeroScrollController'
import { useHeroSceneScale } from './heroSceneLayout'

/* ─── The seven nodes, in tree order ─────────────────────────────────────── */

type Tone = 'violet' | 'lime' | 'amber' | 'green'

interface GraphNode {
  key: string
  label: string
  title: string
  meta: string
  tone: Tone
  /** Which scroll-driven opacity reveals this node. */
  drive: 'claim' | 'source' | 'evidence' | 'conflict' | 'verifier' | 'decision'
  /** Focus position: phone anchors first, `lg:` holds the desktop positions. */
  anchor: string
  /** Design width in px, before `node` scaling. */
  width: number
}

const GRAPH_NODES: GraphNode[] = [
  { key: 'claim', label: 'CLAIM', title: '"Fully funded scholarship for international students"', meta: 'Deadline: Aug 30, 2025', tone: 'violet', drive: 'claim', anchor: 'left-[21%] top-[6%] lg:left-[36%] lg:top-[4%]', width: 180 },
  { key: 'official-source', label: 'OFFICIAL SOURCE', title: 'University Website', meta: 'Updated 2 days ago · VERIFIED', tone: 'lime', drive: 'source', anchor: 'left-[1%] top-[24%] lg:left-[24%] lg:top-[22%]', width: 175 },
  { key: 'independent-source', label: 'INDEPENDENT SOURCE', title: 'Education Portal', meta: 'Published Aug 20 · VERIFIED', tone: 'lime', drive: 'source', anchor: 'left-[47%] top-[24%] lg:left-[52%] lg:top-[22%]', width: 175 },
  { key: 'evidence', label: 'EVIDENCE', title: '4 supporting sources', meta: 'Deadline · eligibility · official update', tone: 'violet', drive: 'evidence', anchor: 'left-[1%] top-[43%] lg:left-[24%] lg:top-[42%]', width: 165 },
  { key: 'conflict', label: 'CONFLICT DETECTED', title: 'Different deadline in 1 source', meta: 'Fragment being verified', tone: 'amber', drive: 'conflict', anchor: 'left-[47%] top-[43%] lg:left-[52%] lg:top-[42%]', width: 170 },
  { key: 'verifier', label: 'VERIFIER', title: 'Cross-checking facts & dates…', meta: 'Unsupported evidence fades', tone: 'violet', drive: 'verifier', anchor: 'left-[21%] top-[62%] lg:left-[35%] lg:top-[62%]', width: 185 },
  { key: 'decision', label: 'DECISION', title: 'VERIFY BEFORE APPLYING', meta: '62/100 · Moderate confidence', tone: 'green', drive: 'decision', anchor: 'left-[21%] top-[80%] lg:left-[35%] lg:top-[78%]', width: 185 },
]

/* ─── Connecting lines and junction dots, per shape ──────────────────────── */

/**
 * x/y are percentages of the stage; the SVG is stretched to match the anchors.
 * `vectorEffect="non-scaling-stroke"` below keeps a connector the same weight
 * whether the stage stretches it sideways or downwards.
 */
const EDGES = [
  { stroke: '#7C3AED', width: 2.5, drive: 'source', stage: 'M46 14 C42 18 38 22 36 26', stack: 'M39.5 17 C32 19 24 21 19.5 23' },
  { stroke: '#7C3AED', width: 2.5, drive: 'source', stage: 'M46 14 C50 18 58 22 62 26', stack: 'M39.5 17 C47 19 58 21 65 23' },
  { stroke: '#A3FF12', width: 2.5, drive: 'evidence', stage: 'M36 34 C36 38 36 42 36 46', stack: 'M19.5 35 C19.5 38 19.5 40 19.5 42' },
  { stroke: '#A3FF12', width: 2.5, drive: 'evidence', stage: 'M62 34 C62 38 62 42 62 46', stack: 'M65 35 C65 38 65 40 65 42' },
  { stroke: '#F5B942', width: 2.5, drive: 'conflict', stage: 'M36 54 C40 58 44 62 46 66', stack: 'M19.5 54 C25 57 33 60 39.5 62' },
  { stroke: '#F5B942', width: 2.5, drive: 'conflict', stage: 'M62 54 C58 58 52 62 46 66', stack: 'M65 54 C59 57 51 60 39.5 62' },
  { stroke: '#7C3AED', width: 2.5, drive: 'verifier', stage: 'M46 66 C46 70 46 73 46 76', stack: 'M39.5 61 C39.5 64 39.5 68 39.5 72' },
  { stroke: '#A3FF12', width: 3, drive: 'decision', stage: 'M46 78 C46 82 46 86 46 90', stack: 'M39.5 73 C39.5 75 39.5 78 39.5 80' },
] as const

/** [x, y, colour] — one dot per node, drawn as HTML so it stays a true circle. */
const DOTS = [
  { stage: [46, 14], stack: [39.5, 17], fill: '#7C3AED' },
  { stage: [36, 30], stack: [19.5, 35], fill: '#A3FF12' },
  { stage: [62, 30], stack: [65, 35], fill: '#A3FF12' },
  { stage: [36, 50], stack: [19.5, 54], fill: '#A3FF12' },
  { stage: [62, 50], stack: [65, 54], fill: '#F5B942' },
  { stage: [46, 66], stack: [39.5, 62], fill: '#F5B942' },
  { stage: [46, 76], stack: [39.5, 73], fill: '#7C3AED' },
  { stage: [46, 92], stack: [39.5, 85], fill: '#A3FF12' },
] as const

function MiniNode({ label, title, meta, tone = 'violet' }: { label: string; title: string; meta?: string; tone?: Tone }) {
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
  const { node, wide } = useHeroSceneScale()

  /* Progressive path-draw offsets (one per tree segment) */
  const sourceOffset = useTransform(values.sourceDraw, [0, 1], [1, 0])
  const evidenceOffset = useTransform(values.evidenceDraw, [0, 1], [1, 0])
  const conflictOffset = useTransform(values.conflictDraw, [0, 1], [1, 0])
  const verifierOffset = useTransform(values.verifierDraw, [0, 1], [1, 0])
  const decisionOffset = useTransform(values.decisionDraw, [0, 1], [1, 0])

  const draw = {
    source: values.sourceDraw, evidence: values.evidenceDraw, conflict: values.conflictDraw,
    verifier: values.verifierDraw, decision: values.decisionDraw,
  }
  const offset = {
    source: sourceOffset, evidence: evidenceOffset, conflict: conflictOffset,
    verifier: verifierOffset, decision: decisionOffset,
  }
  const nodeOpacity = {
    claim: values.claimOpacity, source: values.sourceOpacity, evidence: values.evidenceOpacity,
    conflict: values.conflictOpacity, verifier: values.verifierOpacity, decision: values.decisionOpacity,
  }
  const shape = wide ? 'stage' : 'stack'

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
      data-node-scale={node}
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-70 lg:opacity-85"
      style={{ y: values.parallaxNet }}
      aria-hidden="true"
    >
      <motion.div style={{ x: pointer.midX, y: pointer.midY }} className="absolute inset-x-0 top-[13%] h-[86%]">

        {/* ── SVG connecting lines ── */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="networkGlow">
              <feGaussianBlur stdDeviation="0.25" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <g fill="none" strokeLinecap="round" filter="url(#networkGlow)">
            {EDGES.map((edge) => (
              <motion.path
                key={`${edge.drive}-${edge.stage}`}
                d={edge[shape]}
                stroke={edge.stroke}
                strokeWidth={edge.width}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="1"
                style={{
                  pathLength: draw[edge.drive],
                  pathOffset: offset[edge.drive],
                  opacity: nodeOpacity[edge.drive],
                }}
              />
            ))}
          </g>
        </svg>

        {/* ── Junction dots ── */}
        {DOTS.map((dot) => {
          const [x, y] = dot[shape]
          return (
            <span
              key={`${dot.fill}-${x}-${y}`}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x}%`, top: `${y}%`, background: dot.fill, opacity: 0.7 }}
            />
          )
        })}

        {/* ── Nodes ── */}
        {GRAPH_NODES.map((n) => (
          <motion.div
            key={n.key}
            className={`absolute ${n.anchor}`}
            style={{
              opacity: nodeOpacity[n.drive],
              ...(n.key === 'conflict' ? { x: conflictX } : null),
            }}
          >
            <div style={{ width: n.width, transform: `scale(${node})`, transformOrigin: 'top left' }}>
              <MiniNode label={n.label} title={n.title} meta={n.meta} tone={n.tone} />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
