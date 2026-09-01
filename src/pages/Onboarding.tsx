import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { TrustlifyLogo } from '@/components/TrustlifyLogo'
import { useUserProfile } from '@/hooks/useUserProfile'

const steps = [
  { num: '01', label: 'BASIC' },
  { num: '02', label: 'EDUCATION' },
  { num: '03', label: 'SKILLS' },
  { num: '04', label: 'INTERESTS' },
  { num: '05', label: 'COMPLETE' },
]

const inputClass = 'w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors appearance-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const {
    profile,
    loading: profileLoading,
    loadError: profileLoadError,
    reload,
    createProfile,
  } = useUserProfile()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', age: '', location: '',
    education: '',
    skills: [] as string[], experience: '',
    interests: [] as string[], portfolio: '',
  })

  // Hydrate from the persisted profile once loaded (blank form for new users)
  useEffect(() => {
    if (profileLoading) return
    setForm({
      name: profile.name || '',
      age: profile.age != null ? String(profile.age) : '',
      location: profile.location || '',
      education: profile.education || '',
      skills: profile.skills || [],
      interests: profile.interests || [],
      experience: profile.experience || '',
      portfolio: profile.portfolioUrl || '',
    })
  }, [profileLoading, profile])

  const skillOptions = ['Python', 'Data Analysis', 'Research', 'Writing', 'Design', 'JavaScript', 'Machine Learning', 'Public Speaking', 'Project Management', 'Excel/Sheets']
  const interestOptions = ['Scholarships', 'Internships', 'Research Opportunities', 'Hackathons', 'Courses', 'Jobs', 'Fellowships', 'Conferences']

  const toggleSkill = (s: string) => setForm(f => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s] }))
  const toggleInterest = (s: string) => setForm(f => ({ ...f, interests: f.interests.includes(s) ? f.interests.filter(x => x !== s) : [...f.interests, s] }))

  const variants = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } }

  const handleComplete = async () => {
    if (!form.name.trim()) {
      setError('Please enter your full name.')
      setStep(0)
      return
    }
    setSaving(true)
    setError('')
    const { error: saveError } = await createProfile({
      displayName: form.name.trim(),
      role: 'student',
      education: form.education || null,
      age: form.age ? Number(form.age) : null,
      location: form.location || null,
      skills: form.skills,
      interests: form.interests,
      experience: form.experience || null,
      portfolioUrl: form.portfolio || null,
    })
    setSaving(false)
    if (saveError) {
      // saveError is already a safe, user-facing sentence from the API layer.
      setError(saveError)
      return
    }
    setStep(4)
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet animate-progress-pulse" />
          <span className="font-mono text-xs text-dim tracking-wider">LOADING…</span>
        </div>
      </div>
    )
  }

  // The profile could not be read. Showing a blank first-time form here would
  // let a returning student overwrite a profile that simply failed to load,
  // so the only options offered are retry and continue.
  if (profileLoadError) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <TrustlifyLogo size={6} />
            <span className="font-mono text-xs tracking-wider text-bone">TRUSTLIFY</span>
          </div>
          <div className="font-mono text-[10px] text-caution tracking-wider mb-2">PROFILE NOT LOADED</div>
          <h2 className="font-display mb-4" style={{ fontSize: 28, fontWeight: 300 }}>We could not verify your profile.</h2>
          <p className="font-mono text-xs text-dim mb-8">{profileLoadError}</p>
          <div className="flex flex-col items-center gap-3">
            <Button variant="violet" onClick={reload}>TRY AGAIN</Button>
            <button onClick={() => navigate('/dashboard')} className="font-mono text-[10px] text-dim hover:text-soft cursor-pointer">
              CONTINUE TO DASHBOARD →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-void flex flex-col px-4 py-12">
      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-12">
          <TrustlifyLogo size={6} />
          <span className="font-mono text-xs tracking-wider text-bone">TRUSTLIFY</span>
        </div>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-1">
                <div className={`flex flex-col items-center gap-1 ${i <= step ? '' : 'opacity-30'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all font-mono text-[10px] ${
                    i < step ? 'bg-lime border-lime text-void'
                    : i === step ? 'border-violet text-violet'
                    : 'border-white/15 text-dim'
                  }`}>
                    {i < step ? '✓' : s.num}
                  </div>
                  <span className="font-mono text-[8px] text-dim hidden sm:block">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-all ${i < step ? 'bg-lime' : 'bg-white/[0.06]'}`} style={{ width: '2rem' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" {...variants} transition={{ duration: 0.3 }}>
                <div className="font-mono text-[10px] text-violet tracking-wider mb-2">STEP 01 · BASIC</div>
                <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>Tell us about yourself.</h2>
                <div className="space-y-4">
                  <Field label="FULL NAME">
                    <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="AGE">
                      <input className={inputClass} value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="Your age" type="number" min={1} />
                    </Field>
                    <Field label="LOCATION">
                      <input className={inputClass} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Country" />
                    </Field>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" {...variants} transition={{ duration: 0.3 }}>
                <div className="font-mono text-[10px] text-violet tracking-wider mb-2">STEP 02 · EDUCATION</div>
                <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>Your academic background.</h2>
                <div className="space-y-4">
                  <Field label="DEGREE / QUALIFICATION">
                    <select className={inputClass} value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))}>
                      <option value="">Select level</option>
                      <option>Matric / O-Levels</option>
                      <option>FSc / A-Levels</option>
                      <option>BS / Bachelor's</option>
                      <option>MS / Master's</option>
                      <option>PhD</option>
                    </select>
                  </Field>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" {...variants} transition={{ duration: 0.3 }}>
                <div className="font-mono text-[10px] text-violet tracking-wider mb-2">STEP 03 · SKILLS</div>
                <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>What are you good at?</h2>
                <div className="flex flex-wrap gap-2 mb-6">
                  {skillOptions.map((s) => (
                    <button key={s} onClick={() => toggleSkill(s)}
                      className={`px-3 py-2 rounded-full border font-mono text-xs transition-all cursor-pointer ${
                        form.skills.includes(s) ? 'border-violet bg-[rgba(124,58,237,0.15)] text-bone' : 'border-white/10 text-dim hover:border-white/20 hover:text-soft'
                      }`}>{s}</button>
                  ))}
                </div>
                <Field label="EXPERIENCE / PROJECTS (OPTIONAL)">
                  <textarea className={`${inputClass} resize-none`} rows={3} value={form.experience}
                    onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
                    placeholder="Briefly describe any relevant experience, projects, or achievements..." />
                </Field>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" {...variants} transition={{ duration: 0.3 }}>
                <div className="font-mono text-[10px] text-violet tracking-wider mb-2">STEP 04 · INTERESTS</div>
                <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>What do you investigate?</h2>
                <p className="font-mono text-xs text-dim mb-6">Select the types of opportunities you most commonly encounter and need to verify.</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {interestOptions.map((s) => (
                    <button key={s} onClick={() => toggleInterest(s)}
                      className={`px-3 py-2 rounded-full border font-mono text-xs transition-all cursor-pointer ${
                        form.interests.includes(s) ? 'border-lime bg-lime-dim text-bone' : 'border-white/10 text-dim hover:border-white/20 hover:text-soft'
                      }`}>{s}</button>
                  ))}
                </div>
                <Field label="PORTFOLIO / LINKEDIN (OPTIONAL)">
                  <input className={inputClass} value={form.portfolio} onChange={e => setForm(f => ({ ...f, portfolio: e.target.value }))} placeholder="https://..." />
                </Field>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" {...variants} transition={{ duration: 0.3 }} className="text-center">
                <div className="w-16 h-16 rounded-full bg-lime-dim border border-[rgba(163,255,18,0.3)] flex items-center justify-center mx-auto mb-6">
                  <span className="text-lime text-2xl">✓</span>
                </div>
                <div className="font-mono text-[10px] text-lime tracking-wider mb-2">PROFILE COMPLETE</div>
                <h2 className="font-display mb-4" style={{ fontSize: 40, fontWeight: 300 }}>You're ready to investigate.</h2>
                <p className="font-mono text-sm text-dim mb-10 max-w-sm mx-auto">
                  Your student profile powers personalized eligibility matching. You can update it anytime in settings.
                </p>
                <div className="card-noir p-5 text-left max-w-xs mx-auto mb-8">
                  <div className="font-mono text-[10px] text-dim mb-3">YOUR PROFILE</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Name', value: form.name || '—' },
                      { label: 'Education', value: form.education || '—' },
                      { label: 'Location', value: form.location || '—' },
                      { label: 'Skills', value: form.skills.length ? form.skills.slice(0, 3).join(', ') : '—' },
                    ].map(f => (
                      <div key={f.label} className="flex justify-between">
                        <span className="font-mono text-[10px] text-dim">{f.label}</span>
                        <span className="font-mono text-[10px] text-soft">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-[rgba(255,77,94,0.25)] bg-[rgba(255,77,94,0.06)]">
            <span className="font-mono text-xs text-danger">{error}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 && step < 4 ? (
            <button onClick={() => setStep(s => s - 1)} className="font-mono text-xs text-dim hover:text-soft cursor-pointer">← BACK</button>
          ) : <div />}
          {step < 4 ? (
            <Button variant="violet" onClick={() => {
              if (step === 3) {
                handleComplete()
              } else {
                setStep(s => s + 1)
              }
            }} disabled={saving}>
              {saving ? 'SAVING…' : step === 3 ? 'COMPLETE PROFILE' : 'CONTINUE'} →
            </Button>
          ) : (
            <Button variant="lime" size="lg" onClick={() => navigate('/dashboard')}>GO TO DASHBOARD →</Button>
          )}
        </div>
      </div>
    </div>
  )
}
