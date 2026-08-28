import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useInvestigation, INVESTIGATION_STAGES } from '@/hooks/useInvestigation'

type StageStatus = 'done' | 'active' | 'pending' | 'conflict'

const statusConfig: Record<StageStatus, { color: string; icon: string; bg: string; border: string }> = {
  done: { color: 'text-lime', icon: '✓', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.25)]' },
  active: { color: 'text-violet', icon: '●', bg: 'bg-[rgba(124,58,237,0.1)]', border: 'border-[rgba(124,58,237,0.4)]' },
  pending: { color: 'text-dim', icon: '○', bg: 'bg-transparent', border: 'border-white/[0.06]' },
  conflict: { color: 'text-caution', icon: '⚠', bg: 'bg-[rgba(245,185,66,0.08)]', border: 'border-[rgba(245,185,66,0.25)]' },
}

export default function InvestigationProgress() {
  const navigate = useNavigate()
  const { stageIndex, isComplete, conflictDetected, elapsed } = useInvestigation({ autoStart: true })

  const getStatus = (i: number): StageStatus => {
    if (conflictDetected && i === 4) return 'conflict'
    if (i < stageIndex) return 'done'
    if (i === stageIndex) return isComplete ? 'done' : 'active'
    return 'pending'
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className="font-mono text-[10px] text-dim tracking-wider mb-2">DEMO INVESTIGATION · ID #T-2408-0042</div>
            <h1 className="font-display mb-3" style={{ fontSize: 36, fontWeight: 300 }}>
              {isComplete ? 'Investigation Complete' : 'Investigating...'}
            </h1>
            <div className="font-mono text-xs text-dim max-w-sm mx-auto">
              "apply-scholarship.com/fund2025 — Fully Funded Scholarship 2025"
            </div>
          </motion.div>

          {/* Stages */}
          <div className="relative">
            <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: 'linear-gradient(to bottom, rgba(124,58,237,0.5), rgba(163,255,18,0.3))' }} />
            <div className="space-y-3">
              <AnimatePresence>
                {INVESTIGATION_STAGES.map((stage, i) => {
                  const status = getStatus(i)
                  const cfg = statusConfig[status]
                  const visible = i <= stageIndex || isComplete
                  return (
                    <motion.div key={stage.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: visible ? 1 : 0.3, x: visible ? 0 : -4 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      className={`flex items-start gap-5 p-4 rounded-xl border transition-all duration-500 ${cfg.bg} ${cfg.border}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ring-4 ring-void transition-all ${
                        status === 'done' ? 'bg-lime'
                        : status === 'active' ? 'bg-violet animate-progress-pulse'
                        : status === 'conflict' ? 'bg-caution'
                        : 'bg-dim/40'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-medium ${cfg.color}`}>{stage.label}</span>
                          {status === 'active' && <span className="font-mono text-[9px] text-violet animate-progress-pulse">RUNNING</span>}
                        </div>
                        {(status === 'done' || status === 'conflict' || status === 'active') && (
                          <div className="font-mono text-[10px] text-dim mt-0.5">{stage.desc}</div>
                        )}
                      </div>
                      <span className={`font-mono text-sm flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Conflict callout */}
          <AnimatePresence>
            {conflictDetected && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-6 p-4 rounded-xl border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.05)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-caution text-xs">⚠</span>
                  <span className="font-mono text-xs text-caution">CONFLICT DETECTED</span>
                </div>
                <p className="font-mono text-[10px] text-soft">
                  The deadline shown in the circulating post (Aug 15) conflicts with the official source (Aug 25). This will be flagged in the evidence report.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isComplete && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
                <div className="font-mono text-[10px] text-lime tracking-wider mb-4">
                  INVESTIGATION COMPLETE · {INVESTIGATION_STAGES.length} stages · {elapsed}s elapsed
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="lime" size="lg" onClick={() => navigate('/investigation/demo')}>VIEW RESULTS →</Button>
                  <Button variant="outline" onClick={() => navigate('/investigation/demo/evidence')}>EVIDENCE GRAPH</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  )
}
