import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { apiFetch } from '@/lib/supabase'

interface MonitoringItem {
  id: string
  investigationId: string
  active: boolean
  lastCheckedAt: string | null
  createdAt: string
}

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Monitoring() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MonitoringItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/monitoring')
      .then(res => setItems(res.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleMonitoring = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newActive = !item.active

    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, active: newActive } : i))

    try {
      await apiFetch(`/api/monitoring/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: newActive }),
      })
    } catch {
      // Revert on error
      setItems(prev => prev.map(i => i.id === id ? { ...i, active: !newActive } : i))
    }
  }

  const activeCount = items.filter(i => i.active).length

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <div className="mb-8">
              <div className="font-mono text-[10px] text-dim tracking-wider mb-2">ACTIVE MONITORING</div>
              <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>
                Monitoring <span className="text-violet">{activeCount}</span> Opportunities
              </h1>
            </div>
          </motion.div>

          {loading ? (
            <div className="card-noir p-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
                <span className="font-mono text-xs text-dim">Loading…</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            /* Empty state */
            <div className="card-noir p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👁</span>
              </div>
              <div className="font-mono text-sm text-bone mb-2">No monitoring items yet</div>
              <div className="font-mono text-xs text-dim mb-6 max-w-xs mx-auto">
                After completing an investigation, you can enable monitoring to track changes in deadlines, requirements, and more.
              </div>
              <Button variant="lime" size="sm" onClick={() => navigate('/investigate')}>START AN INVESTIGATION →</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="card-noir p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-base mb-0.5" style={{ fontWeight: 300 }}>Investigation</div>
                      <div className="font-mono text-[10px] text-dim">{item.investigationId}</div>
                    </div>
                    <button onClick={() => toggleMonitoring(item.id)}
                      className={`relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${item.active ? 'bg-violet' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${item.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div>
                      <span className="font-mono text-[9px] text-dim">STATUS </span>
                      <span className={`font-mono text-[11px] font-medium ${item.active ? 'text-lime' : 'text-dim'}`}>
                        {item.active ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </div>
                    {item.lastCheckedAt && (
                      <div>
                        <span className="font-mono text-[9px] text-dim">LAST CHECKED </span>
                        <span className="font-mono text-[11px] text-soft">
                          {new Date(item.lastCheckedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="font-mono text-[9px] text-dim">CREATED </span>
                      <span className="font-mono text-[11px] text-soft">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button onClick={() => navigate(`/investigation/${item.investigationId}`)}
                    className="mt-4 font-mono text-[10px] text-violet hover:text-[#A855F7] cursor-pointer">
                    VIEW INVESTIGATION →
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
