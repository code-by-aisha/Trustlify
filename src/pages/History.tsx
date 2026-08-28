import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { StatusBadge } from '@/components/ui'
import { demoHistory } from '@/data/mock'

const verdictColor: Record<string, string> = {
  LEGITIMATE: 'text-lime',
  'LIKELY LEGITIMATE': 'text-lime',
  'VERIFY BEFORE APPLYING': 'text-caution',
  'HIGH RISK — DO NOT PROCEED': 'text-danger',
  'HIGH RISK': 'text-danger',
}

export default function History() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div className="font-mono text-[10px] text-dim tracking-wider mb-2">INVESTIGATION HISTORY</div>
            <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>
              {demoHistory.length} Investigations
            </h1>
          </motion.div>

          <div className="relative">
            <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-white/[0.06] hidden md:block" />
            <div className="space-y-2">
              {demoHistory.map((inv, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }} className="flex items-start gap-0 group">
                  {/* Date */}
                  <div className="hidden md:block w-28 text-right pr-6 pt-4 flex-shrink-0">
                    <div className="font-mono text-[10px] text-dim leading-tight">
                      {inv.date.split(',')[0]}<br />{inv.date.split(',')[1]?.trim()}
                    </div>
                  </div>
                  {/* Node */}
                  <div className="hidden md:flex items-start pt-4 flex-shrink-0 w-6 justify-center">
                    <div className={`w-2 h-2 rounded-full ring-4 ring-void flex-shrink-0 ${
                      inv.status === 'verified' ? 'bg-lime' : inv.status === 'conflict' ? 'bg-caution' : 'bg-danger'
                    }`} />
                  </div>
                  {/* Card */}
                  <div className="flex-1 md:pl-6 pb-2">
                    <div onClick={() => navigate('/investigation/demo')}
                      className="card-noir p-5 hover:border-white/15 transition-all cursor-pointer group-hover:bg-white/[0.01]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="md:hidden font-mono text-[10px] text-dim mb-1">{inv.date}</div>
                          <div className="font-mono text-sm font-medium text-bone mb-0.5">{inv.title}</div>
                          <div className="font-mono text-[10px] text-dim">{inv.org}</div>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-3 flex items-center flex-wrap gap-4">
                        <div>
                          <span className={`font-mono text-xs font-medium ${verdictColor[inv.verdict] || 'text-soft'}`}>{inv.verdict}</span>
                        </div>
                        {inv.match !== 'N/A' && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-dim">MATCH</span>
                            <span className="font-mono text-[9px] text-soft">{inv.match}</span>
                          </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); navigate('/investigation/demo/evidence') }}
                          className="ml-auto font-mono text-[9px] text-dim hover:text-violet transition-colors cursor-pointer">
                          VIEW EVIDENCE →
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
