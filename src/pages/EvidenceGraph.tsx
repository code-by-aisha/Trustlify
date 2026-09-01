import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, useNodesState, useEdgesState, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useInvestigation, stagesForInput, stageIndexOf } from '@/hooks/useInvestigation'
import type { Claim, Source, Evidence, EvidenceRelation } from '@/types'

/* ─── CUSTOM NODES ────────────────────────────────────────────────────────── */

const nodeColorMap: Record<string, { border: string; bg: string; text: string }> = {
  claim: { border: 'rgba(124,58,237,0.7)', bg: 'rgba(124,58,237,0.12)', text: '#7C3AED' },
  source: { border: 'rgba(163,255,18,0.5)', bg: 'rgba(163,255,18,0.08)', text: '#A3FF12' },
  conflict: { border: 'rgba(245,185,66,0.5)', bg: 'rgba(245,185,66,0.08)', text: '#F5B942' },
  evidence: { border: 'rgba(255,77,94,0.5)', bg: 'rgba(255,77,94,0.08)', text: '#FF4D5E' },
  verification: { border: 'rgba(245,185,66,0.5)', bg: 'rgba(245,185,66,0.08)', text: '#F5B942' },
  decision: { border: 'rgba(163,255,18,0.7)', bg: 'rgba(163,255,18,0.12)', text: '#A3FF12' },
}

function EvidenceNodeCard({ data }: { data: { label: string; sublabel: string; nodeType: string; animate?: boolean } }) {
  const c = nodeColorMap[data.nodeType] || nodeColorMap.source
  return (
    <motion.div
      initial={data.animate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="px-4 py-3 rounded-xl text-center min-w-[140px] max-w-[220px]"
      style={{
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        boxShadow: `0 0 12px ${c.border.replace('0.5', '0.2').replace('0.7', '0.3')}`,
      }}>
      <Handle type="target" position={Position.Top} style={{ background: c.text, width: 6, height: 6 }} />
      <div className="font-mono text-[9px] font-semibold tracking-wider opacity-80">{data.label}</div>
      <div className="font-mono text-[11px] text-bone mt-1 leading-snug break-words">{data.sublabel}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: c.text, width: 6, height: 6 }} />
    </motion.div>
  )
}

const nodeTypes = { evidenceCard: EvidenceNodeCard }

/* ─── REAL DATA → GRAPH ADAPTER ────────────────────────────────────────────── */

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed
}

/** The claim the targeted search was built from (selected, else first). */
function primaryClaim(investigation: { claims: Claim[]; selectedClaimId?: string | null }): Claim | null {
  if (investigation.claims.length === 0) return null
  return (
    investigation.claims.find((c) => c.id === investigation.selectedClaimId) ??
    investigation.claims[0]
  )
}

/* ─── Verified evidence edge styling ────────────────────────────────────── */

const EDGE_BY_RELATION: Record<EvidenceRelation, { label: string; stroke: string; animated: boolean; dashed?: boolean }> = {
  supports: { label: 'SUPPORTS', stroke: '#A3FF12', animated: true },
  contradicts: { label: 'CONTRADICTS', stroke: '#FF4D5E', animated: true },
  neutral: { label: 'NEUTRAL', stroke: '#A1A1AA', animated: false },
  insufficient: { label: 'INSUFFICIENT', stroke: '#F5B942', animated: false, dashed: true },
}

/** Claim node tint by deterministic claim status (spec 23). */
function claimNodeType(status: string | undefined): string {
  if (status === 'contradicted' || status === 'conflicting') return 'conflict'
  return 'claim'
}

/** Layout caps — the backend analyzes at most 8 claims and dedupes sources. */
const MAX_GRAPH_CLAIMS = 8
const MAX_GRAPH_SOURCES = 12

/**
 * Build graph nodes/edges from REAL investigation data.
 * Nodes appear only when the backend has actually produced them — no fake
 * nodes, no invented relationships. Claim→source edges carry the VERIFIED
 * evidence relation (supports/contradicts/neutral/insufficient) whose excerpt
 * was checked against real source content; sources the analysis did not
 * connect to a claim keep the neutral DISCOVERED edge from the primary claim.
 */
function buildGraph(investigation: {
  claims: Claim[]
  sources: Source[]
  evidence: Evidence[]
  selectedClaimId?: string | null
}): { nodes: Node[]; edges: Edge[] } {
  if (investigation.claims.length === 0) return { nodes: [], edges: [] }

  const evidence = investigation.evidence
  const claimsWithEvidence = new Set(evidence.map((item) => item.claimId))

  // Claims that participate in verified evidence (up to the cap); before any
  // evidence exists the primary claim carries the discovery edges alone.
  const claimsToRender = investigation.claims
    .filter((claim) => claimsWithEvidence.has(claim.id))
    .slice(0, MAX_GRAPH_CLAIMS)
  const anchor = primaryClaim(investigation)
  if (claimsToRender.length === 0 && anchor) claimsToRender.push(anchor)
  if (claimsToRender.length === 0) return { nodes: [], edges: [] }
  const claimIds = new Set(claimsToRender.map((claim) => claim.id))

  // Evidence sources first (they carry the real relationships), then the
  // remaining discovered sources, up to the layout cap.
  const evidenceSourceIds = new Set(
    evidence.filter((item) => claimIds.has(item.claimId)).map((item) => item.sourceId),
  )
  const sourcesToRender = [
    ...investigation.sources.filter((source) => evidenceSourceIds.has(source.id)),
    ...investigation.sources.filter((source) => !evidenceSourceIds.has(source.id)),
  ].slice(0, MAX_GRAPH_SOURCES)

  const nodes: Node[] = []
  const edges: Edge[] = []

  /* Claim row (bottom) */
  const claimStep = claimsToRender.length > 1 ? 900 / (claimsToRender.length - 1) : 0
  claimsToRender.forEach((claim, i) => {
    nodes.push({
      id: `claim-${claim.id}`,
      type: 'evidenceCard',
      position: { x: claimsToRender.length > 1 ? 50 + i * claimStep : 500, y: 360 },
      data: {
        label: `CLAIM · ${(claim.status ?? 'pending').toUpperCase()}`,
        sublabel: truncate(claim.text, 44),
        nodeType: claimNodeType(claim.status),
        animate: true,
      },
    })
  })

  /* Source rows (top) */
  const perRow = sourcesToRender.length > 6 ? Math.ceil(sourcesToRender.length / 2) : sourcesToRender.length
  const rowStep = perRow > 1 ? 900 / (perRow - 1) : 0
  sourcesToRender.forEach((source, i) => {
    const row = sourcesToRender.length > 6 ? Math.floor(i / perRow) : 0
    const col = sourcesToRender.length > 6 ? i % perRow : i
    nodes.push({
      id: `src-${source.id}`,
      type: 'evidenceCard',
      position: { x: perRow > 1 ? 50 + col * rowStep : 500, y: 40 + row * 120 },
      data: {
        label: `SOURCE · ${(source.sourceType ?? 'unknown').toUpperCase()}`,
        sublabel: source.domain || truncate(source.title, 24),
        nodeType: 'source',
        animate: true,
      },
    })
  })

  /* Verified evidence edges — only real, excerpt-verified relationships */
  for (const item of evidence) {
    if (!claimIds.has(item.claimId)) continue
    if (!sourcesToRender.some((source) => source.id === item.sourceId)) continue
    const style = EDGE_BY_RELATION[item.relation] ?? EDGE_BY_RELATION.neutral
    edges.push({
      id: `ev-${item.id}`,
      source: `claim-${item.claimId}`,
      target: `src-${item.sourceId}`,
      label: style.label,
      animated: style.animated,
      labelStyle: { fontSize: 8, fontFamily: 'monospace', fill: style.stroke },
      labelBgStyle: { fill: '#0C0C12' },
      style: {
        stroke: style.stroke,
        strokeWidth: 1.5,
        ...(style.dashed ? { strokeDasharray: '4 3' } : {}),
      },
    })
  }

  /* Discovery edges for sources the analysis did not connect */
  const anchoredSourceIds = new Set(edges.map((edge) => edge.target))
  const anchorId = anchor && claimIds.has(anchor.id) ? anchor.id : claimsToRender[0]!.id
  for (const source of sourcesToRender) {
    if (anchoredSourceIds.has(`src-${source.id}`)) continue
    edges.push({
      id: `edge-${source.id}`,
      source: `claim-${anchorId}`,
      target: `src-${source.id}`,
      label: 'DISCOVERED',
      animated: true,
      labelStyle: { fontSize: 8, fontFamily: 'monospace', fill: '#A1A1AA' },
      labelBgStyle: { fill: '#0C0C12' },
      style: { stroke: '#7C3AED', strokeWidth: 1.5 },
    })
  }

  return { nodes, edges }
}

/* ─── DETAIL PANEL MODEL ───────────────────────────────────────────────────── */

interface GraphDetail {
  kind: 'claim' | 'source'
  title: string
  domain: string
  type: string
  published: string
  retrieved: string
  relation: string
  excerpt: string
  excerptLabel: string
  url?: string
}

/** Strongest verified relation a source has to any claim. */
function sourceRelation(sourceId: string, evidence: Evidence[]): string {
  const relations = evidence.filter((item) => item.sourceId === sourceId).map((item) => item.relation)
  if (relations.includes('supports')) return 'SUPPORTS'
  if (relations.includes('contradicts')) return 'CONTRADICTS'
  if (relations.includes('neutral')) return 'NEUTRAL'
  if (relations.includes('insufficient')) return 'INSUFFICIENT'
  return 'DISCOVERED'
}

function buildDetail(
  nodeId: string,
  investigation: {
    claims: Claim[]
    sources: Source[]
    evidence: Evidence[]
    selectedClaimId?: string | null
    createdAt?: string
  },
): GraphDetail | null {
  if (nodeId.startsWith('claim-')) {
    const claim = investigation.claims.find((c) => c.id === nodeId.slice(6))
    if (!claim) return null
    return {
      kind: 'claim',
      title: 'Extracted Claim',
      domain: `input · ${investigation.createdAt ? new Date(investigation.createdAt).toLocaleDateString() : ''}`,
      type: `CLAIM · ${claim.type.replace(/_/g, ' ').toUpperCase()}`,
      published: claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : '—',
      retrieved: '—',
      relation: (claim.status ?? 'pending').toUpperCase(),
      excerpt: claim.reasoningSummary || claim.text,
      excerptLabel: claim.reasoningSummary ? 'DETERMINISTIC CLAIM STATUS REASON' : 'CLAIM TEXT',
    }
  }

  if (nodeId.startsWith('src-')) {
    const sourceId = nodeId.slice(4)
    const source = investigation.sources.find((s) => s.id === sourceId)
    if (!source) return null
    const excerpts = investigation.evidence
      .filter((item) => item.sourceId === sourceId && item.excerpt)
      .map((item) => item.excerpt)
    return {
      kind: 'source',
      title: source.title,
      domain: source.domain,
      type: `SOURCE · ${(source.sourceType ?? 'unknown').toUpperCase()}`,
      // Unknown stays unknown — publication dates are never invented
      published: source.publishedAt ? new Date(source.publishedAt).toLocaleDateString() : 'UNKNOWN',
      retrieved: source.retrievedAt ? new Date(source.retrievedAt).toLocaleDateString() : '—',
      relation: sourceRelation(sourceId, investigation.evidence),
      excerpt: excerpts.length > 0 ? excerpts.join(' … ') : source.snippet || 'No snippet stored for this source.',
      excerptLabel: excerpts.length > 0 ? 'VERIFIED EVIDENCE EXCERPT' : 'SEARCH SNIPPET (UNVERIFIED DATA)',
      url: source.url,
    }
  }

  return null
}

const relationColor: Record<string, string> = {
  DISCOVERED: 'text-violet border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)]',
  PENDING: 'text-dim border-white/15 bg-white/[0.04]',
  SUPPORTED: 'text-lime border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.08)]',
  SUPPORTS: 'text-lime border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.08)]',
  CONFLICTING: 'text-caution border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)]',
  CONTRADICTED: 'text-danger border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.08)]',
  CONTRADICTS: 'text-danger border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.08)]',
  UNSUPPORTED: 'text-caution border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)]',
  INSUFFICIENT: 'text-dim border-white/15 bg-white/[0.04]',
  NEUTRAL: 'text-dim border-white/15 bg-white/[0.04]',
}

/* ─── MAIN COMPONENT ───────────────────────────────────────────────────────── */

export default function EvidenceGraph() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { investigation, isLoading, error, notFound } = useInvestigation(id)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'list'>('graph')

  const stages = stagesForInput(investigation?.inputType)
  const stageIndex = stageIndexOf(investigation?.currentStage, stages)
  const stageMeta = stages[stageIndex]
  const isRunning = investigation?.status === 'created' || investigation?.status === 'processing'

  /* Real graph from real data — recomputed whenever polled state changes */
  const graph = useMemo(
    () =>
      investigation
        ? buildGraph({
            claims: investigation.claims,
            sources: investigation.sources,
            evidence: investigation.evidence,
            selectedClaimId: investigation.selectedClaimId,
          })
        : { nodes: [] as Node[], edges: [] as Edge[] },
    [investigation],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  /* Sync computed graph into React Flow state as real data arrives */
  useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  const detail = useMemo(
    () =>
      investigation && selected
        ? buildDetail(selected, {
            claims: investigation.claims,
            sources: investigation.sources,
            evidence: investigation.evidence,
            selectedClaimId: investigation.selectedClaimId,
            createdAt: investigation.createdAt,
          })
        : null,
    [investigation, selected],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelected((prev) => (prev === node.id ? null : node.id))
  }, [])

  if (isLoading && !investigation) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center">
          <div className="font-mono text-xs text-dim animate-progress-pulse">LOADING EVIDENCE GRAPH…</div>
        </div>
      </AppShell>
    )
  }

  if (notFound || (!investigation && error)) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="font-mono text-xs text-danger mb-3">INVESTIGATION NOT FOUND</div>
            <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="font-mono text-[10px] text-dim mb-1">
                INVESTIGATION · {(investigation?.id ?? '').toUpperCase().slice(0, 13)}
              </div>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 300 }}>Evidence Graph</h1>
              {/* Real stage indicator */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-violet animate-progress-pulse' : investigation?.status === 'complete' ? 'bg-lime' : 'bg-danger'}`} />
                <span className={`font-mono text-[10px] ${isRunning ? 'text-violet' : investigation?.status === 'complete' ? 'text-lime' : 'text-danger'}`}>
                  {stageMeta.label}
                </span>
                <span className="font-mono text-[10px] text-dim">· Stage {stageIndex + 1}/{stages.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-surface rounded-full p-1 border border-white/[0.06]">
                {(['graph', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-full font-mono text-xs tracking-wider transition-all cursor-pointer ${view === v ? 'bg-violet text-white' : 'text-dim'}`}>
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button variant="lime" size="sm" onClick={() => navigate(`/investigation/${id}`)}>VIEW RESULTS →</Button>
            </div>
          </motion.div>

          {/* Investigation failure banner — real reason from the backend */}
          {investigation?.status === 'failed' && (
            <div className="mb-6 p-4 rounded-xl border border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.05)]">
              <div className="flex items-center gap-2">
                <span className="text-danger text-xs">⚠</span>
                <span className="font-mono text-xs text-danger">INVESTIGATION FAILED</span>
              </div>
              <p className="font-mono text-[10px] text-soft mt-1">
                {investigation.errorMessage || 'The investigation could not be completed.'}
              </p>
            </div>
          )}

          {/* Legend — honest: what the graph actually shows */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {[
              { color: 'bg-violet', label: 'Claim' },
              { color: 'bg-lime', label: 'Source' },
              { color: 'bg-lime', label: 'Supports (verified evidence)' },
              { color: 'bg-danger', label: 'Contradicts (verified evidence)' },
              { color: 'bg-caution', label: 'Insufficient' },
              { color: 'bg-violet', label: 'Discovered link' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-6 h-0.5 rounded ${l.color}`} />
                <span className="font-mono text-[10px] text-dim">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              {view === 'graph' ? (
                <div className="card-noir overflow-hidden" style={{ height: 560 }}>
                  {graph.nodes.length > 0 ? (
                    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                      onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
                      defaultEdgeOptions={{ type: 'smoothstep' }}>
                      <Background color="rgba(255,255,255,0.03)" gap={20} />
                      <Controls />
                      <MiniMap nodeColor={(n) => {
                        const t = n.data?.nodeType as string
                        return nodeColorMap[t]?.text || '#A1A1AA'
                      }} maskColor="rgba(10,10,15,0.8)" />
                    </ReactFlow>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.08)] flex items-center justify-center mb-4">
                        <span className="text-violet text-xl">⊹</span>
                      </div>
                      <div className="font-mono text-xs text-dim max-w-sm">
                        {isRunning
                          ? `Nodes appear as the investigation progresses. Currently: ${stageMeta.label}.`
                          : 'No claims were recorded for this investigation.'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card-noir overflow-hidden">
                  {graph.nodes.length > 0 ? (
                    graph.nodes.map((node, i) => (
                      <button key={node.id} onClick={() => setSelected(selected === node.id ? null : node.id)}
                        className={`w-full flex items-center gap-4 px-6 py-4 text-left cursor-pointer transition-all hover:bg-white/[0.02] ${i < graph.nodes.length - 1 ? 'border-b border-white/[0.06]' : ''} ${selected === node.id ? 'bg-white/[0.03]' : ''}`}>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: nodeColorMap[node.data?.nodeType as string]?.text || '#A1A1AA' }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-medium" style={{ color: nodeColorMap[node.data?.nodeType as string]?.text || '#A1A1AA' }}>{node.data?.label as string}</div>
                          <div className="font-mono text-[10px] text-dim truncate">{node.data?.sublabel as string}</div>
                        </div>
                        <span className="font-mono text-[10px] text-dim">VIEW →</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-6 py-12 text-center font-mono text-xs text-dim">
                      No nodes recorded yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Detail panel — real data only */}
            <div className="lg:col-span-1">
              {detail ? (
                <motion.div key={selected} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="card-noir-violet p-5 h-full">
                  <div className="font-mono text-[10px] text-dim mb-1">{detail.type}</div>
                  <h3 className="font-display text-lg mb-1" style={{ fontWeight: 300 }}>{truncate(detail.title, 60)}</h3>
                  <div className="font-mono text-xs text-dim mb-4">{detail.domain}</div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="font-mono text-[9px] text-dim">PUBLISHED</div>
                      <div className="font-mono text-[11px] text-soft">{detail.published}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-dim">RETRIEVED</div>
                      <div className="font-mono text-[11px] text-soft">{detail.retrieved}</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-dim mb-2">{detail.excerptLabel}</div>
                    <div className="font-display text-sm text-bone leading-relaxed italic" style={{ fontWeight: 300 }}>{detail.excerpt}</div>
                  </div>
                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-dim mb-2">RELATION TO CLAIM</div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border font-mono text-xs ${relationColor[detail.relation]}`}>
                      {detail.relation}
                    </span>
                  </div>
                  {detail.kind === 'source' && detail.url && (
                    <button
                      onClick={() => window.open(detail.url, '_blank', 'noopener,noreferrer')}
                      className="w-full py-2 rounded-xl border border-white/10 font-mono text-xs text-soft hover:border-violet hover:text-violet transition-all cursor-pointer">
                      OPEN SOURCE ↗
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="card-noir p-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.08)] flex items-center justify-center mb-4">
                    <span className="text-violet text-xl">⊹</span>
                  </div>
                  <div className="font-mono text-xs text-dim">
                    {isRunning
                      ? `Nodes appear as the investigation progresses. Currently: ${stageMeta.label}.`
                      : 'Select a node to view claim and source details.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
