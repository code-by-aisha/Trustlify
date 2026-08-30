import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { apiFetch } from '@/lib/supabase'

interface HistoryItem {
  id: string
  inputText: string | null
  inputType: string
  status: string
  verdict: string | null
  trustScore: number | null
  createdAt: string
}

const verdictColor: Record<string, string> = {
  VERIFIED: 'text-lime',
  CAUTION: 'text-caution',
  HIGH_RISK: 'text-danger',
  UNVERIFIED: 'text-dim',
}

export default function History() {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchHistory = async (off: number) => {
    try {
      const res = await apiFetch(`/api/history?limit=${limit}&offset=${off}`)
      setItems(res.data ?? [])
      setTotal(res.meta?.total ?? 0)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory(0) }, [])

  const loadMore = () => {
    const next = offset + limit
    setOffset(next)
    fetchHistory(next)
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="font-mono text-[10px] text-dim tracking-wider mb-2">INVESTIGATION HISTORY</div>
            <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>
              {loading ? '…' : `${total} Investigation${total !== 1 ? 's' : ''}`}
            </h1>
          </motion.div>

          {loading ? (
            <div className="card-noir p-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
                <span className="font-mono text-xs text-dim">Loading history…</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty state */
            <div className="card-noir p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📋</span>
              </div>
              <div className="font-mono text-sm text-bone mb-2">No investigations yet</div>
              <div className="font-mono text-xs text-dim mb-6 max-w-xs mx-auto">
                Your investigation history will appear here once you start verifying claims.
              </div>
              <Button variant="lime" size="sm" onClick={() => navigate('/investigate')}>START INVESTIGATING →</Button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-white/[0.06] hidden md:block" />
              <div className="space-y-2">
                {items.map((inv, i) => (
                  <motion.div key={inv.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }} className="flex items-start gap-0 group">
                    {/* Date */}
                    <div className="hidden md:block w-28 text-right pr-6 pt-4 flex-shrink-0">
                      <div className="font-mono text-[10px] text-dim leading-tight">
                        {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}<br />
                        {new Date(inv.createdAt).getFullYear()}
                      </div>
                    </div>
                    {/* Node */}
                    <div className="hidden md:flex items-start pt-4 flex-shrink-0 w-6 justify-center">
                      <div className={`w-2 h-2 rounded-full ring-4 ring-void flex-shrink-0 ${
                        inv.verdict === 'VERIFIED' ? 'bg-lime' : inv.verdict === 'CAUTION' ? 'bg-caution' : inv.verdict === 'HIGH_RISK' ? 'bg-danger' : 'bg-dim'
                      }`} />
                    </div>
                    {/* Card */}
                    <div className="flex-1 md:pl-6 pb-2">
                      <div onClick={() => navigate(`/investigation/${inv.id}`)}
                        className="card-noir p-5 hover:border-white/15 transition-all cursor-pointer group-hover:bg-white/[0.01]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="md:hidden font-mono text-[10px] text-dim mb-1">
                              {new Date(inv.createdAt).toLocaleDateString()}
                            </div>
                            <div className="font-mono text-sm font-medium text-bone mb-0.5">
                              {inv.inputText || `${inv.inputType} investigation`}
                            </div>
                            <div className="font-mono text-[10px] text-dim">{inv.inputType.toUpperCase()}</div>
                          </div>
                          {inv.verdict && (
                            <span className={`font-mono text-[10px] font-medium ${verdictColor[inv.verdict] || 'text-soft'}`}>
                              {inv.verdict}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-4">
                          <span className={`font-mono text-[10px] ${
                            inv.status === 'complete' ? 'text-lime' : inv.status === 'processing' ? 'text-violet' : 'text-dim'
                          }`}>
                            {inv.status?.toUpperCase()}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/investigation/${inv.id}`) }}
                            className="ml-auto font-mono text-[9px] text-dim hover:text-violet transition-colors cursor-pointer">
                            VIEW DETAILS →
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Load more */}
              {offset + limit < total && (
                <div className="text-center mt-6">
                  <button onClick={loadMore} className="font-mono text-xs text-violet hover:text-[#A855F7] cursor-pointer">
                    LOAD MORE →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
