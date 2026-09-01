import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useAuth } from '@/hooks/useAuth'

const sections = ['Profile', 'Language', 'Privacy', 'Notifications']
const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

/**
 * The structured education levels the backend recognises (same enum as
 * `profiles.education_level`). "" means "not picked" — the backend then reads a
 * level from the qualification text, so the two fields can never disagree.
 */
const EDUCATION_LEVELS: { value: string; label: string }[] = [
  { value: '', label: 'Auto — from my education text' },
  { value: 'HIGH_SCHOOL', label: 'High school (Matric / O-Levels)' },
  { value: 'COLLEGE', label: 'College (Intermediate / A-Levels)' },
  { value: 'UNDERGRADUATE', label: "Undergraduate (Bachelor's level)" },
  { value: 'GRADUATE', label: "Graduate (Bachelor's degree held)" },
  { value: 'POSTGRADUATE', label: "Postgraduate (Master's / PhD)" },
  { value: 'OTHER', label: 'Other / not classified' },
]

export default function Settings() {
  const [active, setActive] = useState('Profile')
  const { profile, setProfile, loadError: profileLoadError } = useUserProfile()
  const { user, signOut } = useAuth()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [langMsg, setLangMsg] = useState('')

  const [lang, setLang] = useState(profile.language || 'English')
  const [notifications, setNotifications] = useState(profile.notificationPreferences || {
    deadlineChanges: true, newEvidence: true, weeklyDigest: false, monitoringAlerts: true,
  })

  /* Sync from profile when it loads */
  useEffect(() => {
    if (profile.language) setLang(profile.language)
    if (profile.notificationPreferences) setNotifications(profile.notificationPreferences)
  }, [profile.language, profile.notificationPreferences])

  /* Controlled profile fields */
  const [fields, setFields] = useState({
    name: '', email: '', age: '', location: '', education: '',
    country: '', educationLevel: '', fieldOfStudy: '', portfolio: '',
  })

  useEffect(() => {
    setFields({
      name: profile.name || profile.displayName || '',
      email: user?.email || '',
      age: profile.age?.toString() || '',
      location: profile.location || '',
      education: profile.education || '',
      country: profile.country || '',
      educationLevel: profile.educationLevel || '',
      fieldOfStudy: profile.fieldOfStudy || '',
      portfolio: profile.portfolioUrl || '',
    })
  }, [
    profile.name, profile.displayName, profile.age, profile.location, profile.education,
    profile.country, profile.educationLevel, profile.fieldOfStudy, profile.portfolioUrl,
    user?.email,
  ])

  const handleSave = async () => {
    // Empty strings are not valid for these fields — send null (or omit) instead
    const partial: Parameters<typeof setProfile>[0] = {
      displayName: fields.name || undefined,
      education: fields.education || null,
      location: fields.location || null,
      country: fields.country || null,
      fieldOfStudy: fields.fieldOfStudy || null,
      portfolioUrl: fields.portfolio || null,
      age: fields.age ? Number(fields.age) : null,
    }
    // An explicit pick wins. Left empty, the backend derives the level from the
    // qualification text in the same request.
    if (fields.educationLevel) partial.educationLevel = fields.educationLevel

    const { error } = await setProfile(partial)
    if (error) {
      setSaveFailed(true)
      setSaveMsg('Save failed: ' + error)
    } else {
      setSaveFailed(false)
      setSaveMsg('Saved successfully.')
    }
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const handleLangChange = async (label: string) => {
    setLang(label)
    await setProfile({ language: label })
    setLangMsg('Language saved.')
    setTimeout(() => setLangMsg(''), 2500)
  }

  const handleNotifToggle = async (key: string) => {
    const updated = { ...notifications, [key]: !notifications[key as keyof typeof notifications] }
    setNotifications(updated)
    await setProfile({ notificationPreferences: updated })
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
                <div className="pt-4 border-t border-white/[0.06] mt-4">
                  <button onClick={() => signOut()}
                    className="w-full text-left px-4 py-2.5 rounded-xl font-mono text-xs tracking-wider text-danger hover:bg-[rgba(255,77,94,0.08)] transition-all cursor-pointer">
                    SIGN OUT
                  </button>
                </div>
              </nav>
            </div>

            {/* Content */}
            <div className="col-span-12 md:col-span-9">
              {active === 'Profile' && (
                <motion.div key="profile" {...fade} className="space-y-4">
                  <div className="card-noir p-6">
                    <div className="font-mono text-xs text-violet tracking-wider mb-4">PROFILE</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {([
                        { key: 'name', label: 'FULL NAME' },
                        { key: 'email', label: 'EMAIL', readOnly: true },
                        { key: 'age', label: 'AGE' },
                        { key: 'country', label: 'COUNTRY', placeholder: 'e.g. Pakistan' },
                        { key: 'location', label: 'CITY / LOCATION', placeholder: 'e.g. Karachi' },
                        { key: 'education', label: 'EDUCATION (AS YOU WRITE IT)', placeholder: 'e.g. BS Computer Science, 2027' },
                        { key: 'fieldOfStudy', label: 'FIELD OF STUDY', placeholder: 'e.g. Computer Science' },
                        { key: 'portfolio', label: 'PUBLIC PORTFOLIO URL', placeholder: 'https://…' },
                      ] as { key: keyof typeof fields; label: string; readOnly?: boolean; placeholder?: string }[]).map((f) => (
                        <div key={f.label}>
                          <label className="font-mono text-[9px] text-dim tracking-wider block mb-1">{f.label}</label>
                          <input value={fields[f.key]} readOnly={f.readOnly} placeholder={f.placeholder}
                            onChange={(e) => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                            className={`w-full bg-void border border-white/[0.07] rounded-xl px-3 py-2.5 font-mono text-xs text-bone placeholder:text-dim/60 focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors ${f.readOnly ? 'opacity-50 cursor-not-allowed' : ''}`} />
                        </div>
                      ))}
                      <div>
                        <label className="font-mono text-[9px] text-dim tracking-wider block mb-1">EDUCATION LEVEL</label>
                        <select
                          value={fields.educationLevel}
                          onChange={(e) => setFields(prev => ({ ...prev, educationLevel: e.target.value }))}
                          className="w-full bg-void border border-white/[0.07] rounded-xl px-3 py-2.5 font-mono text-xs text-bone focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors cursor-pointer">
                          {EDUCATION_LEVELS.map((level) => (
                            <option key={level.value || 'AUTO'} value={level.value} className="bg-void">{level.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* What the new structured fields are for — and the hard limit on
                        the public URL: it is read as untrusted text, never as truth. */}
                    <div className="mt-4 font-mono text-[10px] text-dim leading-relaxed">
                      Country, education level and field of study are compared against the real
                      requirements an investigation finds. Leave anything you do not want recorded
                      empty — an absent value stays “not recorded”, never a guess.
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-dim leading-relaxed">
                      The portfolio URL must be a public page. Trustlify reads it with the same safe
                      fetcher it uses for sources (no logins, no private pages), treats it as
                      untrusted text, and never overwrites the fields above with it.
                    </div>
                    {profile.skills && profile.skills.length > 0 && (
                      <div className="mt-4">
                        <label className="font-mono text-[9px] text-dim tracking-wider block mb-1">SKILLS</label>
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.map((s) => (
                            <span key={s} className="px-3 py-1 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] font-mono text-xs text-bone">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-6 flex items-center gap-4">
                      <Button variant="violet" size="sm" onClick={handleSave}>SAVE CHANGES</Button>
                      {saveMsg && (
                        <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          className={`font-mono text-[10px] ${saveFailed ? 'text-danger' : 'text-lime'}`}>{saveFailed ? '✗' : '✓'} {saveMsg}</motion.span>
                      )}
                    </div>
                    {/* A profile we could not read is not an empty profile — say so
                        instead of leaving the fields silently blank. */}
                    {profileLoadError && (
                      <div className="mt-4 px-4 py-3 rounded-xl border border-[rgba(255,183,3,0.25)] bg-[rgba(255,183,3,0.06)]">
                        <span className="font-mono text-[10px] text-caution">✗ {profileLoadError}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {active === 'Language' && (
                <motion.div key="lang" {...fade} className="card-noir p-6">
                  <div className="font-mono text-xs text-violet tracking-wider mb-4">LANGUAGE PREFERENCE</div>
                  {/* What Roman Urdu does — and the exact limit of it (no machine translation). */}
                  <p className="font-mono text-[10px] text-dim leading-relaxed mb-4">
                    Roman Urdu changes how Trustlify presents its own structured result: section
                    headings, status words and the summary sentences. Evidence, quoted excerpts,
                    source titles, URLs and your own question stay exactly as they are. It uses fixed
                    templates — no AI is called to translate anything.
                  </p>
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
                      { key: 'deadlineChanges', label: 'Deadline changes', desc: 'Notify when a monitored deadline changes' },
                      { key: 'monitoringAlerts', label: 'Monitoring alerts', desc: 'Notify when any monitored opportunity changes' },
                      { key: 'newEvidence', label: 'New evidence', desc: 'Notify when new sources are found for saved investigations' },
                      { key: 'weeklyDigest', label: 'Weekly digest', desc: 'Summary of your investigations and monitored opportunities' },
                    ].map((n) => (
                      <div key={n.key} className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-mono text-sm text-bone">{n.label}</div>
                          <div className="font-mono text-[10px] text-dim">{n.desc}</div>
                        </div>
                        <button onClick={() => handleNotifToggle(n.key)}
                          className={`relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${notifications[n.key as keyof typeof notifications] ? 'bg-violet' : 'bg-white/10'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${notifications[n.key as keyof typeof notifications] ? 'left-5' : 'left-0.5'}`} />
                        </button>
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
