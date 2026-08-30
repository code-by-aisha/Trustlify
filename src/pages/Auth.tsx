import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { TrustlifyLogo } from '@/components/TrustlifyLogo'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'

type AuthMode = 'choose' | 'student' | 'general'
type AuthView = 'signup' | 'login' | 'forgot' | 'reset-confirm'

/** Map raw Supabase errors to friendly messages */
function friendlyError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('too many requests'))
    return 'Too many requests right now. Please wait a few minutes and try again.'
  if (lower.includes('invalid login credentials')) return 'Invalid email or password.'
  if (lower.includes('email not confirmed')) return 'Please verify your email before logging in.'
  if (lower.includes('user already registered')) return 'This email already has an account.'
  if (lower.includes('password should be')) return 'Password must be at least 6 characters.'
  if (lower.includes('session missing') || lower.includes('not authenticated') || lower.includes('user not found'))
    return 'This reset link is invalid or has expired. Please request a new one.'
  if (lower.includes('email')) return 'Please enter a valid email address.'
  return msg
}

export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signUp, signIn, signOut, resetPassword, updatePassword } = useAuth()

  const [mode, setMode] = useState<AuthMode>(
    params.get('mode') === 'student' ? 'student' : 'choose'
  )
  const [authType, setAuthType] = useState<AuthView>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { user, loading } = useAuth()
  const { profile, exists: profileExists, loadedFor: profileLoadedFor, loading: profileLoading } = useUserProfile()

  // Recovery-link landing: /auth?mode=reset-confirm (session comes from the link)
  useEffect(() => {
    if (params.get('mode') === 'reset-confirm') {
      setAuthType('reset-confirm')
      setMode('general')
      setError('')
      setSuccess('')
    }
  }, [params])

  // Confirmation-email landing: /auth?confirmed=1 without a session
  useEffect(() => {
    if (params.get('confirmed') === '1' && !user && !loading) {
      setAuthType('login')
      setSuccess('Email verified — you can log in now.')
    }
  }, [params, user, loading])

  // Already authenticated — route by the persisted role once the profile loads.
  // Users without a profile row yet follow the persona chosen on this page.
  useEffect(() => {
    if (loading || !user || authType === 'reset-confirm') return
    // Wait until the profile state belongs to the signed-in user (avoids stale
    // post-logout state deciding the route)
    if (profileLoading || profileLoadedFor !== user.id) return
    if (!profileExists) {
      navigate(mode === 'student' ? '/student/onboarding' : '/dashboard', { replace: true })
      return
    }
    const studentNeedsOnboarding = profile.role === 'student' && !profile.name
    navigate(studentNeedsOnboarding ? '/student/onboarding' : '/dashboard', { replace: true })
  }, [user, loading, authType, profileLoading, profileLoadedFor, profileExists, profile, mode, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      if (authType === 'forgot') {
        const { error: err } = await resetPassword(email)
        if (err) { setError(friendlyError(err.message)) }
        else { setSuccess('Password reset email sent. Check your inbox.') }
        return
      }

      if (authType === 'reset-confirm') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          return
        }
        const { error: err } = await updatePassword(password)
        if (err) { setError(friendlyError(err.message)); return }
        // Sign out so the next login uses the new password
        await signOut()
        setSuccess('Password updated. Log in with your new password.')
        setAuthType('login')
        setPassword('')
        setConfirmPassword('')
        return
      }

      if (authType === 'signup') {
        const { error: err } = await signUp(email, password)
        if (err) { setError(friendlyError(err.message)); return }
        setSuccess('Account created! Check your email to verify, then log in.')
        setAuthType('login')
      } else {
        const { error: err } = await signIn(email, password)
        if (err) { setError(friendlyError(err.message)); return }
        // Redirect happens in the auth-state effect once the profile (role) loads
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center px-4 relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 60%)' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex items-center gap-2.5 mb-16">
        <TrustlifyLogo />
        <span className="font-mono font-semibold tracking-wider text-bone">TRUSTLIFY</span>
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === 'choose' && authType !== 'reset-confirm' ? (
          <motion.div key="choose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
            <h1 className="font-display text-center mb-2" style={{ fontSize: 36, fontWeight: 300 }}>Who are you?</h1>
            <p className="font-mono text-xs text-dim text-center mb-10 tracking-wider">Choose your investigation mode.</p>

            <div className="space-y-3 mb-6">
              <button onClick={() => setMode('student')}
                className="w-full card-noir-violet p-5 text-left group hover:border-[rgba(124,58,237,0.5)] transition-all cursor-pointer rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm font-semibold text-bone mb-1">STUDENT</div>
                    <div className="font-mono text-[11px] text-dim">Profile-based investigation + eligibility matching</div>
                  </div>
                  <span className="text-violet group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              <button onClick={() => setMode('general')}
                className="w-full card-noir p-5 text-left group hover:border-white/15 transition-all cursor-pointer rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm font-semibold text-bone mb-1">GENERAL USER</div>
                    <div className="font-mono text-[11px] text-dim">Investigate any online claim or opportunity</div>
                  </div>
                  <span className="text-soft group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>
            </div>

            <button onClick={() => navigate('/')} className="w-full font-mono text-xs text-dim hover:text-soft transition-colors cursor-pointer py-2">
              ← Back to Trustlify
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
            <button onClick={() => { setMode('choose'); setError(''); setSuccess('') }} className={`font-mono text-xs text-dim hover:text-soft cursor-pointer mb-8 flex items-center gap-1 ${authType === 'reset-confirm' ? 'hidden' : ''}`}>
              ← {mode === 'student' ? 'STUDENT' : 'GENERAL USER'}
            </button>

            <h1 className="font-display mb-2" style={{ fontSize: 36, fontWeight: 300 }}>
              {authType === 'signup' ? 'Create account' : authType === 'forgot' ? 'Reset password' : authType === 'reset-confirm' ? 'Set new password' : 'Welcome back'}
            </h1>
            <p className="font-mono text-xs text-dim mb-8">
              {authType === 'reset-confirm'
                ? 'You followed a password reset link.'
                : mode === 'student' ? 'Student investigation mode.' : 'General investigation mode.'}
            </p>

            {(authType === 'signup' || authType === 'login') && (
              <div className="flex bg-surface rounded-full p-1 mb-8 border border-white/[0.06]">
                {(['signup', 'login'] as const).map((t) => (
                  <button key={t} onClick={() => { setAuthType(t); setError(''); setSuccess('') }}
                    className={`flex-1 py-2 rounded-full font-mono text-xs tracking-wider transition-all cursor-pointer ${
                      authType === t ? 'bg-violet text-white' : 'text-dim'
                    }`}>
                    {t === 'signup' ? 'SIGN UP' : 'LOG IN'}
                  </button>
                ))}
              </div>
            )}

            {/* Error message */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-xl border border-[rgba(255,77,94,0.25)] bg-[rgba(255,77,94,0.06)]">
                <span className="font-mono text-xs text-danger">{error}</span>
              </motion.div>
            )}

            {/* Success message */}
            {success && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-xl border border-[rgba(163,255,18,0.25)] bg-[rgba(163,255,18,0.06)]">
                <span className="font-mono text-xs text-lime">✓ {success}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {authType !== 'reset-confirm' && (
                <div>
                  <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">EMAIL</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="your@email.com"
                    className="w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
                </div>
              )}
              {authType !== 'forgot' && (
                <div>
                  <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">{authType === 'reset-confirm' ? 'NEW PASSWORD' : 'PASSWORD'}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                    placeholder="••••••••"
                    className="w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
                  {(authType === 'signup' || authType === 'reset-confirm') && (
                    <p className="font-mono text-[9px] text-dim mt-1.5">At least 6 characters.</p>
                  )}
                </div>
              )}
              {authType === 'reset-confirm' && (
                <div>
                  <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">CONFIRM PASSWORD</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6}
                    placeholder="••••••••"
                    className="w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
                </div>
              )}
              <Button type="submit" variant="lime" className="w-full justify-center mt-2" disabled={submitting}>
                {submitting ? 'PLEASE WAIT…' : authType === 'signup' ? (mode === 'student' ? 'CREATE STUDENT ACCOUNT →' : 'CREATE ACCOUNT →') : authType === 'forgot' ? 'SEND RESET EMAIL →' : authType === 'reset-confirm' ? 'SET NEW PASSWORD →' : 'LOG IN →'}
              </Button>
            </form>

            {/* Forgot password link */}
            {authType === 'login' && (
              <button onClick={() => { setAuthType('forgot'); setError(''); setSuccess('') }}
                className="w-full mt-3 font-mono text-[10px] text-dim hover:text-soft cursor-pointer text-center">
                Forgot password?
              </button>
            )}
            {(authType === 'forgot' || authType === 'reset-confirm') && (
              <button onClick={() => { setAuthType('login'); setError(''); setSuccess('') }}
                className="w-full mt-3 font-mono text-[10px] text-dim hover:text-soft cursor-pointer text-center">
                ← Back to login
              </button>
            )}

            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="font-mono text-[10px] text-dim">OR</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <p className="mt-4 font-mono text-[10px] text-dim text-center">
              Evidence, not guesses.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
