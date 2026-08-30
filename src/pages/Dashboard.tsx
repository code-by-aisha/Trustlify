import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button, SectionLabel } from '@/components/ui'
import { useUserProfile } from '@/hooks/useUserProfile'
import { apiFetch } from '@/lib/supabase'

interface HistoryItem {
  id: string
  inputText: string | null
  inputType: string
  status: string
  verdict: string | null
  createdAt: string
}

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, loading: profileLoading } = useUserProfile()
  const [investigations, setInvestigations] = useState<HistoryItem[]>([])
  const [invLoading, setInvLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/history?limit=5')
      .then(res => setInvestigations(res.data ?? []))
      .catch(() => setInvestigations([]))
      .finally(() => setInvLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = profile.name || profile.displayName || 'there'

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
                {greeting}, <span className="text-lime">{displayName}</span>
              </h1>
            </div>
            <Button variant="lime" size="lg" onClick={() => navigate('/investigate')}>+ NEW INVESTIGATION</Button>
          </motion.div>

          <div className="grid grid-cols-12 gap-5">
            {/* Quick Investigate */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.05 }} className="col-span-12 lg:col-span-8 card-noir p-6">
              <div className="font-mono text-xs text-soft tracking-wider mb-4">QUICK INVESTIGATE</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'PASTE LINK', icon: '🔗', desc: 'URL or website' },
                  { label: 'PASTE TEXT', icon: '📋', desc: 'Post, message, claim' },
                  { label: 'UPLOAD IMAGE', icon: '🖼', desc: 'Screenshot, PDF' },
                ].map((item) => (
                  <button key={item.label} onClick={() => navigate('/investigate')}
                    className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer text-left group">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <div className="font-mono text-xs font-medium text-bone">{item.label}</div>
                      <div className="font-mono text-[10px] text-dim">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Right column — profile card */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.1 }} className="col-span-12 lg:col-span-4 card-noir p-5">
              <div className="font-mono text-xs text-soft tracking-wider mb-4">YOUR PROFILE</div>
              {profileLoading ? (
                <div className="font-mono text-xs text-dim">Loading…</div>
              ) : profile.name ? (
                <div className="space-y-2">
                  {[
                    { label: 'Name', value: profile.name },
                    { label: 'Education', value: profile.education || '—' },
                    { label: 'Location', value: profile.location || '—' },
                    { label: 'Skills', value: profile.skills?.length ? profile.skills.slice(0, 3).join(', ') : '—' },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between">
                      <span className="font-mono text-[10px] text-dim">{f.label}</span>
                      <span className="font-mono text-[10px] text-soft">{f.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="font-mono text-xs text-dim mb-3">Complete your profile for personalized matching.</p>
                  <Button variant="violet" size="sm" onClick={() => navigate('/student/onboarding')}>COMPLETE PROFILE →</Button>
                </div>
              )}
              <button onClick={() => navigate('/settings')} className="mt-4 w-full font-mono text-[10px] text-violet hover:text-[#A855F7] transition-colors cursor-pointer">
                EDIT PROFILE →
              </button>
            </motion.div>

            {/* Recent Investigations */}
            <motion.div {...fade} transition={{ duration: 0.5, delay: 0.15 }} className="col-span-12">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>RECENT INVESTIGATIONS</SectionLabel>
                {investigations.length > 0 && (
                  <button onClick={() => navigate('/history')} className="font-mono text-[10px] text-violet hover:text-[#A855F7] cursor-pointer">VIEW ALL →</button>
                )}
              </div>

              {invLoading ? (
                <div className="card-noir p-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
                    <span className="font-mono text-xs text-dim">Loading…</span>
                  </div>
                </div>
              ) : investigations.length === 0 ? (
                /* Empty state */
                <div className="card-noir p-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[rgba(124,58,237,0.1)] border border-[rgba(124,58,237,0.2)] flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div className="font-mono text-sm text-bone mb-2">No investigations yet</div>
                  <div className="font-mono text-xs text-dim mb-6 max-w-xs mx-auto">
                    Paste a scholarship link, job post, or suspicious claim to start your first investigation.
                  </div>
                  <Button variant="lime" size="sm" onClick={() => navigate('/investigate')}>START INVESTIGATING →</Button>
                </div>
              ) : (
                <div className="card-noir overflow-hidden">
                  {investigations.map((inv, i) => (
                    <div key={inv.id} onClick={() => navigate(`/investigation/${inv.id}`)}
                      className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-all ${i < investigations.length - 1 ? 'border-b border-white/[0.06]' : ''}`}>
                      <span className="font-mono text-[10px] text-dim w-20 flex-shrink-0">
                        {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs text-bone truncate">
                          {inv.inputText || `${inv.inputType} investigation`}
                        </div>
                      </div>
                      <span className={`font-mono text-[10px] font-medium ${
                        inv.status === 'complete' ? 'text-lime' : inv.status === 'processing' ? 'text-violet' : 'text-dim'
                      }`}>
                        {inv.status?.toUpperCase() ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
