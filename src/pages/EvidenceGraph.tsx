import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, useNodesState, useEdgesState, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useInvestigation, INVESTIGATION_STAGES, stageIndexOf } from '@/hooks/useInvestigation'
import type { Claim, Source } from '@/types'

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

/**
 * Build graph nodes/edges from REAL investigation data.
 * Nodes appear only when the backend has actually produced them — no fake
 * nodes, no invented relationships. Every claim→source edge is the neutral
 * DISCOVERED relation: support/contradiction is NOT established this phase.
 */
function buildGraph(investigation: {
  claims: Claim[]
  sources: Source[]
  selectedClaimId?: string | null
}): { nodes: Node[]; edges: Edge[] } {
  const claim = primaryClaim(investigation)
  if (!claim) return { nodes: [], edges: [] }

  const nodes: Node[] = [
    {
      id: 'claim',
      type: 'evidenceCard',
      position: { x: 400, y: 260 },
      data: { label: 'CLAIM', sublabel: truncate(claim.text, 48), nodeType: 'claim', animate: true },
    },
  ]

  const count = investigation.sources.length
  const spread = count > 1 ? 640 / (count - 1) : 0
  const startX = count > 1 ? 80 : 400

  const edges: Edge[] = investigation.sources.map((source, i) => {
    const y = count > 3 && i >= 3 ? 60 : 40
    const x = count > 3 && i >= 3 ? startX + (i - 3) * spread : startX + i * spread
    nodes.push({
      id: `src-${source.id}`,
      type: 'evidenceCard',
      position: { x, y },
      data: { label: 'SOURCE', sublabel: source.domain || truncate(source.title, 24), nodeType: 'source', animate: true },
    })
    return {
      id: `edge-${source.id}`,
      source: 'claim',
      target: `src-${source.id}`,
      label: 'DISCOVERED',
      animated: true,
      labelStyle: { fontSize: 8, fontFamily: 'monospace', fill: '#A1A1AA' },
      labelBgStyle: { fill: '#0C0C12' },
      style: { stroke: '#7C3AED', strokeWidth: 1.5 },
    }
  })

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
  url?: string
}

function buildDetail(
  nodeId: string,
  investigation: { claims: Claim[]; sources: Source[]; selectedClaimId?: string | null; createdAt?: string },
): GraphDetail | null {
  if (nodeId === 'claim') {
    const claim = primaryClaim(investigation)
    if (!claim) return null
    return {
      kind: 'claim',
      title: 'Extracted Claim',
      domain: `input · ${investigation.createdAt ? new Date(investigation.createdAt).toLocaleDateString() : ''}`,
      type: `CLAIM · ${claim.type.replace(/_/g, ' ').toUpperCase()}`,
      published: claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : '—',
      retrieved: '—',
      relation: 'PENDING',
      excerpt: claim.text,
    }
  }

  if (nodeId.startsWith('src-')) {
    const sourceId = nodeId.slice(4)
    const source = investigation.sources.find((s) => s.id === sourceId)
    if (!source) return null
    return {
      kind: 'source',
      title: source.title,
      domain: source.domain,
      type: `SOURCE · ${(source.sourceType ?? 'unknown').toUpperCase()}`,
      // Unknown stays unknown — publication dates are never invented
      published: source.publishedAt ? new Date(source.publishedAt).toLocaleDateString() : 'UNKNOWN',
      retrieved: source.retrievedAt ? new Date(source.retrievedAt).toLocaleDateString() : '—',
      relation: 'DISCOVERED',
      excerpt: source.snippet || 'No snippet stored for this source.',
      url: source.url,
    }
  }

  return null
}

const relationColor: Record<string, string> = {
  DISCOVERED: 'text-violet border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)]',
  PENDING: 'text-dim border-white/15 bg-white/[0.04]',
}

/* ─── MAIN COMPONENT ───────────────────────────────────────────────────────── */

export default function EvidenceGraph() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { investigation, isLoading, error, notFound } = useInvestigation(id)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'list'>('graph')

  const stageIndex = stageIndexOf(investigation?.currentStage)
  const stageMeta = INVESTIGATION_STAGES[stageIndex]
  const isRunning = investigation?.status === 'created' || investigation?.status === 'processing'

  /* Real graph from real data — recomputed whenever polled state changes */
  const graph = useMemo(
    () =>
      investigation
        ? buildGraph({
            claims: investigation.claims,
            sources: investigation.sources,
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
                <span className="font-mono text-[10px] text-dim">· Stage {stageIndex + 1}/{INVESTIGATION_STAGES.length}</span>
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

          {/* Legend — honest: what the graph actually shows this phase */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {[
              { color: 'bg-violet', label: 'Claim' },
              { color: 'bg-lime', label: 'Discovered source' },
              { color: 'bg-violet', label: 'Discovery link (animated)' },
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
                    <div className="font-mono text-[9px] text-dim mb-2">
                      {detail.kind === 'source' ? 'SEARCH SNIPPET (UNVERIFIED DATA)' : 'CLAIM TEXT'}
                    </div>
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
