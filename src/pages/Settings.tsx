import { useState } from 'react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useUserProfile } from '@/hooks/useUserProfile'

const sections = ['Profile', 'Language', 'Privacy', 'Notifications', 'Saved Evidence']

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Settings() {
  const [active, setActive] = useState('Profile')
  const [lang, setLang] = useState('English')
  const [notifications, setNotifications] = useState({ deadlineChanges: true, newEvidence: true, weeklyDigest: false, monitoringAlerts: true })
  const { profile, setProfile } = useUserProfile()

  /* ── Controlled profile fields ── */
  const [fields, setFields] = useState({
    name: profile.name || 'Aisha',
    email: 'aisha@university.edu.pk',
    age: '22',
    location: profile.location || 'Karachi, Pakistan',
    education: profile.education || 'BS Computer Science',
    institution: 'FAST NUCES Karachi',
  })
  const [saveMsg, setSaveMsg] = useState('')
  const [langMsg, setLangMsg] = useState('')

  const handleSave = () => {
    setProfile({ name: fields.name, education: fields.education, location: fields.location })
    setSaveMsg('Updated for this session.')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const handleLangChange = (label: string) => {
    setLang(label)
    setLangMsg('Updated for this session.')
    setTimeout(() => setLangMsg(''), 2500)
  }

  const handleNotifToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <div className="mb-8">
              <div className="font-mono text-[10px] text-dim tracking-wider mb-2">SETTINGS</div>
              <h1 className="font-display" style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300 }}>Account Settings</h1>
            </div>
          </motion.div>

          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar nav */}
            <div className="col-span-12 md:col-span-3">
              <nav className="space-y-1">
                {sections.map((s) => (
                  <button key={s} onClick={() => setActive(s)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl font-mono text-xs tracking-wider transition-all cursor-pointer ${
                      active === s ? 'bg-[rgba(124,58,237,0.15)] text-bone border border-[rgba(124,58,237,0.3)]' : 'text-dim hover:text-soft'
                    }`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="col-span-12 md:col-span-9">
              {active === 'Profile' && (
                <motion.div key="profile" {...fade} className="space-y-4">
                  <div className="card-noir p-6">
                    <div className="font-mono text-xs text-violet tracking-wider mb-4">STUDENT PROFILE</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: 'name' as const, label: 'FULL NAME' },
                        { key: 'email' as const, label: 'EMAIL' },
                        { key: 'age' as const, label: 'AGE' },
                        { key: 'location' as const, label: 'LOCATION' },
                        { key: 'education' as const, label: 'EDUCATION' },
                        { key: 'institution' as const, label: 'INSTITUTION' },
                      ].map((f) => (
                        <div key={f.label}>
                          <label className="font-mono text-[9px] text-dim tracking-wider block mb-1">{f.label}</label>
                          <input value={fields[f.key]}
                            onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full bg-void border border-white/[0.07] rounded-xl px-3 py-2.5 font-mono text-xs text-bone focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <label className="font-mono text-[9px] text-dim tracking-wider block mb-1">SKILLS</label>
                      <div className="flex flex-wrap gap-2">
                        {['Python', 'Data Analysis', 'Research', 'Writing'].map((s) => (
                          <span key={s} className="px-3 py-1 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] font-mono text-xs text-bone">{s}</span>
                        ))}
                        <button className="px-3 py-1 rounded-full border border-dashed border-white/15 font-mono text-xs text-dim cursor-pointer">+ Add</button>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-4">
                      <Button variant="violet" size="sm" onClick={handleSave}>SAVE CHANGES</Button>
                      {saveMsg && (
                        <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="font-mono text-[10px] text-lime">✓ {saveMsg}</motion.span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {active === 'Language' && (
                <motion.div key="lang" {...fade} className="card-noir p-6">
                  <div className="font-mono text-xs text-violet tracking-wider mb-4">LANGUAGE PREFERENCE</div>
                  <div className="space-y-2">
                    {[
                      { label: 'English', available: true },
                      { label: 'Urdu (اردو)', available: true },
                      { label: 'Roman Urdu', available: true },
                      { label: 'Sindhi (سنڌي)', available: false, note: 'Pending validation' },
                    ].map((l) => (
                      <button key={l.label} onClick={() => l.available && handleLangChange(l.label)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                          l.available ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                        } ${lang === l.label ? 'border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)]' : 'border-white/[0.06] hover:border-white/15'}`}>
                        <span className="font-mono text-sm text-bone">{l.label}</span>
                        <div className="flex items-center gap-2">
                          {l.note && <span className="font-mono text-[10px] text-dim">{l.note}</span>}
                          {lang === l.label && <span className="text-lime text-sm">✓</span>}
                        </div>
                      </button>
                    ))}
                    {langMsg && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-3 font-mono text-[10px] text-lime">✓ {langMsg}</motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {active === 'Privacy' && (
                <motion.div key="privacy" {...fade} className="space-y-4">
                  <div className="card-noir p-6">
                    <div className="font-mono text-xs text-violet tracking-wider mb-4">DATA MANAGEMENT</div>
                    <div className="space-y-4">
                      {[
                        { label: 'Delete all uploaded content', desc: 'Removes all images, PDFs, and documents you\'ve uploaded for investigation.' },
                        { label: 'Delete saved investigations', desc: 'Removes your investigation history and saved reports.' },
                        { label: 'Delete account', desc: 'Permanently removes your account, profile, and all data. This cannot be undone.' },
                      ].map((item, i) => (
                        <div key={item.label} className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
                          <div>
                            <div className={`font-mono text-sm mb-0.5 ${i === 2 ? 'text-danger' : 'text-caution'}`}>{item.label}</div>
                            <div className="font-mono text-[10px] text-dim">{item.desc}</div>
                          </div>
                          <Button variant="outline" size="sm" className="flex-shrink-0">DELETE</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-noir p-5 border-[rgba(163,255,18,0.1)]">
                    <div className="font-mono text-[10px] text-dim">
                      ✓ Trustlify does not sell your data. Uploaded content is deleted after investigation unless you save it explicitly.
                    </div>
                  </div>
                </motion.div>
              )}

              {active === 'Notifications' && (
                <motion.div key="notif" {...fade} className="card-noir p-6">
                  <div className="font-mono text-xs text-violet tracking-wider mb-4">NOTIFICATION PREFERENCES</div>
                  <div className="space-y-4">
                    {[
                      { key: 'deadlineChanges' as const, label: 'Deadline changes', desc: 'Notify when a monitored deadline changes' },
                      { key: 'monitoringAlerts' as const, label: 'Monitoring alerts', desc: 'Notify when any monitored opportunity changes' },
                      { key: 'newEvidence' as const, label: 'New evidence', desc: 'Notify when new sources are found for saved investigations' },
                      { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'Summary of your investigations and monitored opportunities' },
                    ].map((n) => (
                      <div key={n.key} className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-mono text-sm text-bone">{n.label}</div>
                          <div className="font-mono text-[10px] text-dim">{n.desc}</div>
                        </div>
                        <button onClick={() => handleNotifToggle(n.key)}
                          className={`relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${notifications[n.key] ? 'bg-violet' : 'bg-white/10'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${notifications[n.key] ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {active === 'Saved Evidence' && (
                <motion.div key="evidence" {...fade} className="card-noir p-6">
                  <div className="font-mono text-xs text-violet tracking-wider mb-4">SAVED EVIDENCE</div>
                  <div className="space-y-2">
                    {[
                      { title: 'university.edu.pk — Scholarship official page', date: 'Aug 22, 2025', type: 'OFFICIAL SOURCE' },
                      { title: 'hec.gov.pk — HEC announcement', date: 'Aug 20, 2025', type: 'GOVERNMENT SOURCE' },
                      { title: 'Domain analysis — apply-scholarship.com', date: 'Aug 22, 2025', type: 'TECHNICAL EVIDENCE' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-white/15 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-bone truncate">{e.title}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="font-mono text-[9px] text-violet">{e.type}</span>
                            <span className="font-mono text-[9px] text-dim">{e.date}</span>
                          </div>
                        </div>
                        <button className="font-mono text-[10px] text-dim hover:text-danger cursor-pointer">DELETE</button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
