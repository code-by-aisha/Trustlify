import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button, StatusBadge, SectionLabel } from '@/components/ui'
import { demoSavedOpportunities, demoHistory } from '@/data/mock'
import { useUserProfile } from '@/hooks/useUserProfile'
import { INVESTIGATION_STAGES } from '@/hooks/useInvestigation'

const profileFields = [
  { label: 'Education', complete: true },
  { label: 'Location', complete: true },
  { label: 'Skills', complete: true },
  { label: 'Experience', complete: false },
  { label: 'Interests', complete: true },
]

const recentInvestigations = [
  { date: 'Aug 22', title: 'Suspicious scholarship on Instagram', verdict: 'VERIFY BEFORE APPLYING', color: 'text-caution', status: 'conflict' as const },
  { date: 'Aug 20', title: 'LUMS MBA Fellowship link', verdict: 'LIKELY LEGITIMATE', color: 'text-lime', status: 'verified' as const },
  { date: 'Aug 18', title: 'WhatsApp forwarded internship', verdict: 'HIGH RISK', color: 'text-danger', status: 'risk' as const },
  { date: 'Aug 15', title: 'HEC Scholarship portal', verdict: 'LEGITIMATE', color: 'text-lime', status: 'verified' as const },
]

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useUserProfile()
  const completeness = Math.round((profileFields.filter(f => f.complete).length / profileFields.length) * 100)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* Header */}
          <motion.div {...fade} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
            <div>
              <div className="font-mono text-xs text-dim tracking-wider mb-1">
                {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>
                {greeting}, <span className="text-lime">{profile.name}</span>
              </h1>
            </div>
            <Button variant="lime" size="lg" onClick={() => navigate('/investigate')}>+ NEW INVESTIGATION</Button>
          </motion.div>

          <div className="grid grid-cols-12 gap-5">
            {/* Active Investigation */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.05 }} className="col-span-12 lg:col-span-8 card-noir-violet p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-xs text-violet tracking-wider">ACTIVE INVESTIGATION</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet animate-progress-pulse" />
                  <span className="font-mono text-[10px] text-violet">IN PROGRESS</span>
                </div>
              </div>
              <div className="font-display text-xl mb-1" style={{ fontWeight: 300 }}>"HEC Undergraduate Research Award 2025"</div>
              <div className="font-mono text-xs text-dim mb-5">Investigating since 2 minutes ago · DEMO INVESTIGATION</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                {INVESTIGATION_STAGES.slice(0, 4).map((stage, i) => {
                  const done = i < 3
                  const active = i === 3
                  return (
                    <div key={stage.id} className={`rounded-lg px-3 py-2 border font-mono text-[10px] flex items-center gap-1.5 ${
                      done ? 'border-[rgba(163,255,18,0.2)] text-lime bg-lime-dim'
                      : active ? 'border-[rgba(124,58,237,0.4)] text-violet bg-[rgba(124,58,237,0.08)] animate-progress-pulse'
                      : 'border-white/[0.06] text-dim'
                    }`}>
                      <span>{done ? '✓' : active ? '●' : '○'}</span>{stage.label}
                    </div>
                  )
                })}
              </div>
              <Button variant="violet" size="sm" onClick={() => navigate('/investigation/demo/evidence')}>VIEW IN PROGRESS →</Button>
            </motion.div>

            {/* Quick Investigate */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.1 }} className="col-span-12 lg:col-span-4 card-noir p-6">
              <div className="font-mono text-xs text-soft tracking-wider mb-4">QUICK INVESTIGATE</div>
              <div className="space-y-2">
                {[
                  { label: 'PASTE LINK', icon: '🔗', desc: 'URL or website' },
                  { label: 'PASTE TEXT', icon: '📋', desc: 'Post, message, claim' },
                  { label: 'UPLOAD IMAGE', icon: '🖼', desc: 'Screenshot, PDF' },
                ].map((item) => (
                  <button key={item.label} onClick={() => navigate('/investigate')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer text-left group">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <div className="font-mono text-xs font-medium text-bone">{item.label}</div>
                      <div className="font-mono text-[10px] text-dim">{item.desc}</div>
                    </div>
                    <span className="ml-auto text-dim group-hover:text-soft text-xs">→</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Saved Opportunities */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.15 }} className="col-span-12 lg:col-span-8">
              <SectionLabel>SAVED OPPORTUNITIES</SectionLabel>
              <div className="space-y-3">
                {demoSavedOpportunities.map((opp) => (
                  <div key={opp.id} className="card-noir p-5 hover:border-white/15 transition-all cursor-pointer group"
                    onClick={() => navigate(`/investigation/${opp.id}`)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium text-bone mb-0.5 truncate">{opp.title}</div>
                        <div className="font-mono text-[10px] text-dim">{opp.org}</div>
                      </div>
                      <StatusBadge status={opp.verdict} />
                    </div>
                    <div className="mt-3 flex items-center flex-wrap gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-dim">DEADLINE</span>
                        <span className="font-mono text-[10px] text-soft">{opp.deadline}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-dim">MATCH</span>
                        <span className={`font-mono text-[10px] font-medium ${opp.matchColor}`}>{opp.match}</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="font-mono text-[10px] text-dim">Last checked {opp.lastChecked}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              {/* Profile completeness */}
              <motion.div {...fade} transition={{ duration: 0.5, delay: 0.2 }} className="card-noir p-5">
                <div className="font-mono text-xs text-soft tracking-wider mb-4">PROFILE COMPLETENESS</div>
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A3FF12" strokeWidth="2"
                      strokeDasharray={`${completeness} ${100 - completeness}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-sm font-semibold text-lime">{completeness}%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {profileFields.map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-dim">{f.label}</span>
                      <span className={`font-mono text-[10px] ${f.complete ? 'text-lime' : 'text-caution'}`}>{f.complete ? '✓' : '?'}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/settings')} className="mt-4 w-full font-mono text-[10px] text-violet hover:text-[#A855F7] transition-colors cursor-pointer">
                  COMPLETE PROFILE →
                </button>
              </motion.div>

              {/* Monitoring widget */}
              <motion.div {...fade} transition={{ duration: 0.5, delay: 0.25 }} className="card-noir p-5">
                <div className="font-mono text-xs text-soft tracking-wider mb-3">MONITORING</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-3xl" style={{ fontWeight: 300 }}>3</span>
                  <span className="font-mono text-xs text-dim">opportunities</span>
                </div>
                <div className="font-mono text-[10px] text-dim mb-4">Currently being monitored for changes</div>
                <div className="p-3 rounded-xl bg-[rgba(245,185,66,0.06)] border border-[rgba(245,185,66,0.15)]">
                  <div className="font-mono text-[10px] text-caution mb-1">⚡ RECENT CHANGE DETECTED</div>
                  <div className="font-mono text-[10px] text-soft">GSoC 2025 deadline updated</div>
                  <div className="font-mono text-[10px] text-dim">Aug 15 → Aug 30 · Official announcement</div>
                </div>
                <button onClick={() => navigate('/monitoring')} className="mt-3 font-mono text-[10px] text-violet hover:text-[#A855F7] cursor-pointer">
                  VIEW MONITORING →
                </button>
              </motion.div>
            </div>

            {/* Recent Investigations */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.3 }} className="col-span-12">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>RECENT INVESTIGATIONS</SectionLabel>
                <button onClick={() => navigate('/history')} className="font-mono text-[10px] text-violet hover:text-[#A855F7] cursor-pointer">VIEW ALL →</button>
              </div>
              <div className="card-noir overflow-hidden">
                {recentInvestigations.map((inv, i) => (
                  <div key={inv.title} onClick={() => navigate('/investigation/demo')}
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-all ${i < recentInvestigations.length - 1 ? 'border-b border-white/[0.06]' : ''}`}>
                    <span className="font-mono text-[10px] text-dim w-16 flex-shrink-0">{inv.date}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-bone truncate">{inv.title}</div>
                    </div>
                    <span className={`font-mono text-[10px] font-medium hidden sm:block ${inv.color}`}>{inv.verdict}</span>
                    <StatusBadge status={inv.status} />
                    <button className="font-mono text-[10px] text-dim hover:text-violet ml-2 hidden md:block">VIEW EVIDENCE →</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
