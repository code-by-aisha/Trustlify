import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, useNodesState, useEdgesState, Handle, Position } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useInvestigation, INVESTIGATION_STAGES } from '@/hooks/useInvestigation'
import type { InvestigationStage } from '@/types'

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
      className="px-4 py-3 rounded-xl text-center min-w-[140px]"
      style={{
        background: c.bg, border: `1px solid ${c.border}`, color: c.text,
        boxShadow: `0 0 12px ${c.border.replace('0.5', '0.2').replace('0.7', '0.3')}`,
      }}>
      <Handle type="target" position={Position.Top} style={{ background: c.text, width: 6, height: 6 }} />
      <div className="font-mono text-[9px] font-semibold tracking-wider opacity-80">{data.label}</div>
      <div className="font-mono text-[11px] text-bone mt-1">{data.sublabel}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: c.text, width: 6, height: 6 }} />
    </motion.div>
  )
}

const nodeTypes = { evidenceCard: EvidenceNodeCard }

/* ─── DATA ────────────────────────────────────────────────────────────────── */

const allNodes: Node[] = [
  { id: 'claim', type: 'evidenceCard', position: { x: 400, y: 250 }, data: { label: 'CLAIM', sublabel: 'Fully Funded Scholarship 2025', nodeType: 'claim', animate: true } },
  { id: 'src1', type: 'evidenceCard', position: { x: 100, y: 80 }, data: { label: 'OFFICIAL SOURCE', sublabel: 'university.edu.pk', nodeType: 'source', animate: true } },
  { id: 'src2', type: 'evidenceCard', position: { x: 650, y: 80 }, data: { label: 'INDEPENDENT', sublabel: 'HEC announcement', nodeType: 'source', animate: true } },
  { id: 'src3', type: 'evidenceCard', position: { x: 650, y: 420 }, data: { label: 'PUBLIC REPORTS', sublabel: 'Social media flags', nodeType: 'conflict', animate: true } },
  { id: 'ev1', type: 'evidenceCard', position: { x: 100, y: 420 }, data: { label: 'EVIDENCE', sublabel: 'Domain mismatch', nodeType: 'evidence', animate: true } },
  { id: 'verify', type: 'evidenceCard', position: { x: 400, y: 500 }, data: { label: 'VERIFICATION', sublabel: 'Deadline conflict', nodeType: 'verification', animate: true } },
  { id: 'decision', type: 'evidenceCard', position: { x: 400, y: 20 }, data: { label: 'DECISION', sublabel: 'VERIFY BEFORE APPLYING', nodeType: 'decision', animate: true } },
]

const allEdges: Edge[] = [
  { id: 'e1', source: 'claim', target: 'src1', animated: false, style: { stroke: '#7C3AED', strokeWidth: 1.5 } },
  { id: 'e2', source: 'claim', target: 'src2', animated: false, style: { stroke: '#7C3AED', strokeWidth: 1.5 } },
  { id: 'e3', source: 'claim', target: 'src3', animated: false, style: { stroke: '#F5B942', strokeWidth: 1.5, strokeDasharray: '5 5' } },
  { id: 'e4', source: 'claim', target: 'ev1', animated: false, style: { stroke: '#FF4D5E', strokeWidth: 1.5, strokeDasharray: '5 5' } },
  { id: 'e5', source: 'src1', target: 'decision', animated: false, style: { stroke: '#A3FF12', strokeWidth: 1.5 } },
  { id: 'e6', source: 'src2', target: 'decision', animated: false, style: { stroke: '#A3FF12', strokeWidth: 1.5 } },
  { id: 'e7', source: 'src3', target: 'verify', animated: false, style: { stroke: '#F5B942', strokeWidth: 1.5, strokeDasharray: '5 5' } },
  { id: 'e8', source: 'ev1', target: 'verify', animated: false, style: { stroke: '#FF4D5E', strokeWidth: 1.5, strokeDasharray: '5 5' } },
  { id: 'e9', source: 'verify', target: 'decision', animated: false, style: { stroke: '#F5B942', strokeWidth: 1.5, strokeDasharray: '5 5' } },
]

/* ─── STAGE → NODE/EDGE VISIBILITY MAP ──────────────────────────────────── */

const stageVisibility: Record<InvestigationStage, { nodes: string[]; edges: string[] }> = {
  NORMALIZING: { nodes: [], edges: [] },
  CLAIMS: { nodes: ['claim'], edges: [] },
  SEARCH: { nodes: ['claim', 'src1', 'src2', 'src3'], edges: ['e1', 'e2', 'e3'] },
  EVIDENCE: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1'], edges: ['e1', 'e2', 'e3', 'e4'] },
  INVESTIGATING: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1'], edges: ['e1', 'e2', 'e3', 'e4'] },
  VERIFYING: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1', 'verify'], edges: ['e1', 'e2', 'e3', 'e4', 'e7', 'e8', 'e9'] },
  MATCHING: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1', 'verify'], edges: ['e1', 'e2', 'e3', 'e4', 'e7', 'e8', 'e9'] },
  DECIDING: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1', 'verify', 'decision'], edges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'] },
  COMPLETE: { nodes: ['claim', 'src1', 'src2', 'src3', 'ev1', 'verify', 'decision'], edges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'] },
}

const evidenceDetails: Record<string, { title: string; domain: string; type: string; published: string; relation: string; excerpt: string }> = {
  claim: { title: 'Original Claim', domain: 'Forwarded post', type: 'SOCIAL MEDIA', published: 'Aug 10, 2025', relation: 'NEUTRAL', excerpt: '"Fully Funded Scholarship 2025 is open. Deadline Aug 15. Apply at apply-scholarship.com"' },
  src1: { title: 'Official University Website', domain: 'university.edu.pk', type: 'OFFICIAL SOURCE', published: 'Mar 1, 2025', relation: 'SUPPORTS', excerpt: 'The scholarship is open for applications. Official deadline: August 25, 2025. Apply via the official portal only.' },
  src2: { title: 'HEC Official Announcement', domain: 'hec.gov.pk', type: 'GOVERNMENT SOURCE', published: 'Feb 28, 2025', relation: 'SUPPORTS', excerpt: 'Higher Education Commission confirms the scholarship programme is active for the 2025 cycle.' },
  src3: { title: 'Community Reports', domain: 'Various platforms', type: 'PUBLIC REPORTS', published: 'Aug 12–20, 2025', relation: 'CONTRADICTS', excerpt: 'Multiple users report the linked domain is not affiliated with the official institution. Domain registered Aug 7, 2025.' },
  ev1: { title: 'Domain Analysis', domain: 'apply-scholarship.com', type: 'TECHNICAL EVIDENCE', published: 'Aug 22, 2025', relation: 'CONTRADICTS', excerpt: 'Domain registered 15 days ago. No association found with the official institution. Hosting provider differs from official site.' },
  verify: { title: 'Deadline Conflict', domain: 'Verification layer', type: 'CONFLICT EVIDENCE', published: 'Aug 22, 2025', relation: 'CONTRADICTS', excerpt: 'Post claims Aug 15 deadline. Official source confirms Aug 25. A 10-day discrepancy constitutes a significant conflict.' },
  decision: { title: 'Final Verdict', domain: 'Trustlify', type: 'DECISION', published: 'Aug 22, 2025', relation: 'NEUTRAL', excerpt: 'VERIFY BEFORE APPLYING. Evidence score: 62/100. Genuine organization, suspicious third-party link, deadline conflict detected.' },
}

const relationColor: Record<string, string> = {
  SUPPORTS: 'text-lime border-[rgba(163,255,18,0.3)] bg-lime-dim',
  CONTRADICTS: 'text-danger border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.08)]',
  NEUTRAL: 'text-soft border-white/15 bg-white/[0.04]',
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */

export default function EvidenceGraph() {
  const navigate = useNavigate()
  const investigation = useInvestigation({ autoStart: true, speedMultiplier: 1.5 })
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'list'>('graph')

  // Determine visible nodes/edges from investigation stage
  const visibility = stageVisibility[investigation.currentStage]
  const visibleNodeSet = useMemo(() => new Set(visibility.nodes), [visibility.nodes])
  const visibleEdgeSet = useMemo(() => new Set(visibility.edges), [visibility.edges])

  const filteredNodes = useMemo(() =>
    allNodes.filter((n) => visibleNodeSet.has(n.id)),
    [visibleNodeSet]
  )
  const filteredEdges = useMemo(() =>
    allEdges.filter((e) => visibleEdgeSet.has(e.id)).map((e) => ({
      ...e,
      animated: investigation.currentStage === 'COMPLETE' && ['e5', 'e6'].includes(e.id),
    })),
    [visibleEdgeSet, investigation.currentStage]
  )

  const [nodes, , onNodesChange] = useNodesState(filteredNodes)
  const [edges, , onEdgesChange] = useEdgesState(filteredEdges)

  // Sync when investigation progresses
  useMemo(() => {
    // React Flow will reconcile via key-based updates
  }, [filteredNodes, filteredEdges])

  const selectedEvidence = selected ? evidenceDetails[selected] : null
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelected(prev => prev === node.id ? null : node.id)
  }, [])

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="font-mono text-[10px] text-dim mb-1">DEMO INVESTIGATION · ID #T-2408-0042</div>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 300 }}>Evidence Graph</h1>
              {/* Stage indicator */}
              <div className="flex items-center gap-2 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet animate-progress-pulse" />
                <span className="font-mono text-[10px] text-violet">{investigation.stageMeta.label}</span>
                <span className="font-mono text-[10px] text-dim">· Stage {investigation.stageIndex + 1}/{investigation.totalStages}</span>
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
              <Button variant="lime" size="sm" onClick={() => navigate('/investigation/demo')}>VIEW RESULTS →</Button>
            </div>
          </motion.div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {[
              { color: 'bg-violet', label: 'Connection' },
              { color: 'bg-lime', label: 'Verified path' },
              { color: 'bg-caution', label: 'Conflict' },
              { color: 'bg-danger', label: 'High risk' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-6 h-0.5 rounded ${l.color}`} />
                <span className="font-mono text-[10px] text-dim">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              {view === 'graph' ? (
                <div className="card-noir overflow-hidden" style={{ height: 560 }}>
                  <ReactFlow nodes={filteredNodes} edges={filteredEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}
                    defaultEdgeOptions={{ type: 'smoothstep' }}>
                    <Background color="rgba(255,255,255,0.03)" gap={20} />
                    <Controls />
                    <MiniMap nodeColor={(n) => {
                      const t = n.data?.nodeType as string
                      return nodeColorMap[t]?.text || '#A1A1AA'
                    }} maskColor="rgba(10,10,15,0.8)" />
                  </ReactFlow>
                </div>
              ) : (
                <div className="card-noir overflow-hidden">
                  {filteredNodes.map((node, i) => (
                    <button key={node.id} onClick={() => setSelected(selected === node.id ? null : node.id)}
                      className={`w-full flex items-center gap-4 px-6 py-4 text-left cursor-pointer transition-all hover:bg-white/[0.02] ${i < filteredNodes.length - 1 ? 'border-b border-white/[0.06]' : ''} ${selected === node.id ? 'bg-white/[0.03]' : ''}`}>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: nodeColorMap[node.data?.nodeType as string]?.text || '#A1A1AA' }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-medium" style={{ color: nodeColorMap[node.data?.nodeType as string]?.text || '#A1A1AA' }}>{node.data?.label as string}</div>
                        <div className="font-mono text-[10px] text-dim truncate">{node.data?.sublabel as string}</div>
                      </div>
                      <span className="font-mono text-[10px] text-dim">VIEW →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-1">
              {selectedEvidence ? (
                <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="card-noir-violet p-5 h-full">
                  <div className="font-mono text-[10px] text-dim mb-1">{selectedEvidence.type}</div>
                  <h3 className="font-display text-lg mb-1" style={{ fontWeight: 300 }}>{selectedEvidence.title}</h3>
                  <div className="font-mono text-xs text-dim mb-4">{selectedEvidence.domain}</div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="font-mono text-[9px] text-dim">PUBLISHED</div>
                      <div className="font-mono text-[11px] text-soft">{selectedEvidence.published}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-dim">RETRIEVED</div>
                      <div className="font-mono text-[11px] text-soft">Aug 22, 2025</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-dim mb-2">EVIDENCE EXCERPT</div>
                    <div className="font-display text-sm text-bone leading-relaxed italic" style={{ fontWeight: 300 }}>{selectedEvidence.excerpt}</div>
                  </div>
                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-dim mb-2">RELATION</div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border font-mono text-xs ${relationColor[selectedEvidence.relation]}`}>
                      {selectedEvidence.relation}
                    </span>
                  </div>
                  <button className="w-full py-2 rounded-xl border border-white/10 font-mono text-xs text-soft hover:border-violet hover:text-violet transition-all cursor-pointer">
                    OPEN SOURCE ↗
                  </button>
                </motion.div>
              ) : (
                <div className="card-noir p-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.08)] flex items-center justify-center mb-4">
                    <span className="text-violet text-xl">⊹</span>
                  </div>
                  <div className="font-mono text-xs text-dim">
                    {investigation.isComplete
                      ? 'Select a node to view evidence details, source information, and relation type.'
                      : `Nodes appear as the investigation progresses. Currently: ${investigation.stageMeta.label}.`}
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
