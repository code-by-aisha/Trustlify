import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'

const matchFields = [
  { label: 'Education', status: '✓', color: 'text-lime', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.2)]', note: 'BS Computer Science — meets stated requirement', confidence: 'HIGH' },
  { label: 'Age', status: '✓', color: 'text-lime', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.2)]', note: '22 — within stated eligibility range (18–30)', confidence: 'HIGH' },
  { label: 'Location', status: '✓', color: 'text-lime', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.2)]', note: 'Pakistan — open to Pakistani students', confidence: 'HIGH' },
  { label: 'Skills', status: '✓', color: 'text-lime', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.2)]', note: 'Python, Research — relevant to STEM focus', confidence: 'HIGH' },
  { label: 'Experience', status: '?', color: 'text-caution', bg: 'bg-[rgba(245,185,66,0.06)]', border: 'border-[rgba(245,185,66,0.2)]', note: 'Experience requirement not specified in the opportunity', confidence: 'UNCLEAR' },
]

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function StudentMatch() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <button onClick={() => navigate('/investigation/demo')} className="font-mono text-xs text-dim hover:text-soft cursor-pointer mb-8 flex items-center gap-1">
              ← BACK TO RESULTS
            </button>

            <div className="font-mono text-[10px] text-dim tracking-wider mb-2">DEMO INVESTIGATION · STUDENT MATCH</div>
            <h1 className="font-display mb-8" style={{ fontSize: 'clamp(32px,4vw,48px)', fontWeight: 300 }}>YOUR MATCH</h1>

            {/* Match fields */}
            <div className="space-y-3 mb-8">
              {matchFields.map((field, i) => (
                <motion.div key={field.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className={`p-5 rounded-2xl border ${field.bg} ${field.border}`}>
                  <div className="flex items-start gap-4">
                    <span className={`font-mono text-xl font-bold flex-shrink-0 ${field.color}`}>{field.status}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-medium text-bone">{field.label}</span>
                        <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${
                          field.confidence === 'HIGH' ? 'text-lime bg-lime-dim' : 'text-caution bg-[rgba(245,185,66,0.1)]'
                        }`}>{field.confidence} CONFIDENCE</span>
                      </div>
                      <p className="font-mono text-xs text-dim">{field.note}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Overall match */}
            <div className="card-noir-violet p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] text-dim mb-1">MATCH STRENGTH</div>
                  <div className="font-mono text-2xl font-semibold text-lime">STRONG MATCH</div>
                </div>
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A3FF12" strokeWidth="2.5"
                      strokeDasharray="80 20" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-lime">80%</span>
                  </div>
                </div>
              </div>
              <p className="font-mono text-sm text-soft leading-relaxed mb-4">
                You appear likely to meet the listed requirements based on the available information. One criterion (experience) could not be assessed because the opportunity does not specify it clearly.
              </p>
              <div className="p-3 rounded-xl bg-lime-dim border border-[rgba(163,255,18,0.1)]">
                <p className="font-mono text-[10px] text-dim">
                  ⚠ This match assessment is based on publicly stated requirements and your profile. Actual eligibility is determined by the scholarship committee.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="lime" onClick={() => navigate('/investigation/demo')}>← BACK TO VERDICT</Button>
              <Button variant="outline" onClick={() => navigate('/settings')}>UPDATE PROFILE</Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}
