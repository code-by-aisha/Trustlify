import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { StatusBadge } from '@/components/ui'

const monitored = [
  { id: '1', title: 'HEC Research Fellowship 2025', org: 'Higher Education Commission', verdict: 'verified' as const, deadline: 'Sep 30, 2025', lastChecked: '2 hours ago', monitoring: true, change: null },
  { id: '2', title: 'Google Summer of Code 2025', org: 'Google Open Source', verdict: 'conflict' as const, deadline: 'Aug 30, 2025', lastChecked: 'Yesterday', monitoring: true,
    change: { type: 'DEADLINE CHANGE', before: 'August 15, 2025', after: 'August 30, 2025', source: 'Official announcement · gsoc.google.com', date: 'Aug 20, 2025' } },
  { id: '3', title: 'LUMS MBA Fellowship', org: 'LUMS', verdict: 'verified' as const, deadline: 'Oct 15, 2025', lastChecked: '3 days ago', monitoring: true, change: null },
]

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Monitoring() {
  const navigate = useNavigate()
  const [cards, setCards] = useState(monitored)
  const toggleMonitoring = (id: string) => setCards(prev => prev.map(c => c.id === id ? { ...c, monitoring: !c.monitoring } : c))

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <div className="mb-8">
              <div className="font-mono text-[10px] text-dim tracking-wider mb-2">ACTIVE MONITORING</div>
              <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>
                Monitoring <span className="text-violet">{cards.filter(c => c.monitoring).length}</span> Opportunities
              </h1>
            </div>
          </motion.div>

          <div className="space-y-4">
            {cards.map((card, i) => (
              <motion.div key={card.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.06 }}
                className={`card-noir p-6 transition-all ${card.change ? 'border-[rgba(245,185,66,0.3)]' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base mb-0.5" style={{ fontWeight: 300 }}>{card.title}</div>
                    <div className="font-mono text-[10px] text-dim">{card.org}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={card.verdict} />
                    <button onClick={() => toggleMonitoring(card.id)}
                      className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${card.monitoring ? 'bg-violet' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${card.monitoring ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-4">
                  <div>
                    <span className="font-mono text-[9px] text-dim">DEADLINE </span>
                    <span className="font-mono text-[11px] text-soft">{card.deadline}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] text-dim">LAST CHECKED </span>
                    <span className="font-mono text-[11px] text-soft">{card.lastChecked}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] text-dim">MONITORING </span>
                    <span className={`font-mono text-[11px] font-medium ${card.monitoring ? 'text-lime' : 'text-dim'}`}>
                      {card.monitoring ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                {card.change && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 rounded-xl border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.06)]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-caution text-sm">⚡</span>
                      <span className="font-mono text-xs font-semibold text-caution">TRUSTLIFY DETECTED A CHANGE</span>
                      <span className="font-mono text-[9px] text-dim ml-auto">{card.change.date}</span>
                    </div>
                    <div className="font-mono text-[10px] text-dim mb-2">{card.change.type}</div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 p-3 rounded-lg bg-[rgba(255,77,94,0.06)] border border-[rgba(255,77,94,0.15)]">
                        <div className="font-mono text-[9px] text-dim mb-1">BEFORE</div>
                        <div className="font-mono text-xs text-danger">{card.change.before}</div>
                      </div>
                      <span className="text-dim text-lg">→</span>
                      <div className="flex-1 p-3 rounded-lg bg-lime-dim border border-[rgba(163,255,18,0.15)]">
                        <div className="font-mono text-[9px] text-dim mb-1">AFTER</div>
                        <div className="font-mono text-xs text-lime">{card.change.after}</div>
                      </div>
                    </div>
                    <div className="mt-3 font-mono text-[10px] text-dim">Source: {card.change.source}</div>
                  </motion.div>
                )}

                <button onClick={() => navigate(`/investigation/${card.id}`)} className="mt-4 font-mono text-[10px] text-violet hover:text-[#A855F7] cursor-pointer">
                  VIEW EVIDENCE →
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
