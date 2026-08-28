import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { TrustlifyLogo } from '@/components/TrustlifyLogo'


export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'choose' | 'student' | 'general'>(
    params.get('mode') === 'student' ? 'student' : 'choose'
  )
  const [authType, setAuthType] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'student' && authType === 'signup') {
      navigate('/student/onboarding')
    } else {
      navigate('/dashboard')
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
        {mode === 'choose' ? (
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
            <button onClick={() => setMode('choose')} className="font-mono text-xs text-dim hover:text-soft cursor-pointer mb-8 flex items-center gap-1">
              ← {mode === 'student' ? 'STUDENT' : 'GENERAL USER'}
            </button>

            <h1 className="font-display mb-2" style={{ fontSize: 36, fontWeight: 300 }}>
              {authType === 'signup' ? 'Create account' : 'Welcome back'}
            </h1>
            <p className="font-mono text-xs text-dim mb-8">
              {mode === 'student' ? 'Student investigation mode.' : 'General investigation mode.'}
            </p>

            <div className="flex bg-surface rounded-full p-1 mb-8 border border-white/[0.06]">
              {(['signup', 'login'] as const).map((t) => (
                <button key={t} onClick={() => setAuthType(t)}
                  className={`flex-1 py-2 rounded-full font-mono text-xs tracking-wider transition-all cursor-pointer ${
                    authType === t ? 'bg-violet text-white' : 'text-dim'
                  }`}>
                  {t === 'signup' ? 'SIGN UP' : 'LOG IN'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">EMAIL</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ahmad@university.edu.pk"
                  className="w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
              </div>
              <div>
                <label className="font-mono text-[10px] text-dim tracking-wider block mb-1.5">PASSWORD</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-bone placeholder:text-dim focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors" />
              </div>
              <Button type="submit" variant="lime" className="w-full justify-center mt-2">
                {authType === 'signup' ? (mode === 'student' ? 'CREATE STUDENT ACCOUNT →' : 'CREATE ACCOUNT →') : 'LOG IN →'}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="font-mono text-[10px] text-dim">OR</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <button onClick={() => mode === 'student' ? navigate('/student/onboarding') : navigate('/dashboard')}
              className="w-full mt-4 font-mono text-xs text-dim hover:text-soft transition-colors cursor-pointer py-2 text-center">
              Continue as demo user →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
