import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button, StatusBadge } from '@/components/ui'
import { useInvestigation } from '@/hooks/useInvestigation'

const fade = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed
}

export default function InvestigationResult() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { investigation, isLoading, error, notFound } = useInvestigation(id)

  if (isLoading && !investigation) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center">
          <div className="font-mono text-xs text-dim animate-progress-pulse">LOADING INVESTIGATION…</div>
        </div>
      </AppShell>
    )
  }

  if (notFound || (!investigation && error)) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <div className="font-mono text-xs text-danger mb-3">INVESTIGATION NOT FOUND</div>
            <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const claims = investigation?.claims ?? []
  const sources = investigation?.sources ?? []
  const isFailed = investigation?.status === 'failed'
  const isComplete = investigation?.status === 'complete'
  const inputPreview = truncate(investigation?.inputText ?? '', 120)

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <div className="font-mono text-[10px] text-dim tracking-wider mb-6">
              INVESTIGATION · {(investigation?.id ?? '').toUpperCase().slice(0, 13)} · {formatDate(investigation?.createdAt)}
            </div>

            {/* Honest status hero — NO verdict, NO trust score (later phase) */}
            <div className={`card-noir p-8 mb-6 relative overflow-hidden ${isFailed ? 'border-[rgba(255,77,94,0.25)]' : 'border-[rgba(124,58,237,0.25)]'}`}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${isFailed ? '#FF4D5E' : '#7C3AED'}, transparent)`, transform: 'translate(30%, -30%)' }} />
              <div className="font-mono text-xs text-dim tracking-wider mb-2">STATUS</div>
              <h1 className="font-display mb-3" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300 }}>
                {isFailed ? 'INVESTIGATION FAILED' : 'EVIDENCE COLLECTED'}
              </h1>
              <p className="font-mono text-sm text-soft mb-6 max-w-lg">
                {isFailed
                  ? investigation?.errorMessage || 'The investigation could not be completed. Please try again.'
                  : 'Claims and sources have been recorded. Evidence verification and the Trust verdict are produced by the next phase of the investigation engine — nothing on this page is a verdict.'}
              </p>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="font-mono text-[10px] text-dim mb-1">CLAIMS EXTRACTED</div>
                  <div className="font-display text-4xl" style={{ fontWeight: 300 }}>{claims.length}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-dim mb-1">SOURCES DISCOVERED</div>
                  <div className="font-display text-4xl" style={{ fontWeight: 300 }}>{sources.length}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-dim mb-1">INPUT</div>
                  <div className="font-mono text-sm text-bone uppercase">{investigation?.inputType ?? '—'}</div>
                </div>
              </div>
              {inputPreview && (
                <div className="mt-4 font-mono text-[10px] text-dim truncate">SUBMITTED: "{inputPreview}"</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Button variant="violet" onClick={() => navigate(`/investigation/${id}/evidence`)}>EVIDENCE GRAPH</Button>
              <Button variant="outline" onClick={() => navigate('/monitoring')}>SAVE & MONITOR</Button>
              <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
            </div>

            {/* Claims — real, verification pending */}
            <div className="mb-8">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">EXTRACTED CLAIMS</div>
              {claims.length > 0 ? (
                <div className="space-y-2">
                  {claims.map((claim) => (
                    <div key={claim.id} className="card-noir p-5">
                      <div className="flex items-start gap-4">
                        <StatusBadge status="pending" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-bone leading-relaxed">{claim.text}</div>
                          <div className="font-mono text-[10px] text-dim mt-2">
                            TYPE: {claim.type.replace(/_/g, ' ').toUpperCase()} · IMPORTANCE: {claim.importance.toUpperCase()} · VERIFICATION: PENDING
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-noir p-5 font-mono text-xs text-dim">No claims were recorded.</div>
              )}
            </div>

            {/* Sources — real, conservatively classified */}
            <div className="mb-8">
              <div className="font-mono text-xs text-lime tracking-wider mb-4">DISCOVERED SOURCES</div>
              {sources.length > 0 ? (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div key={source.id} className="card-noir p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-bone truncate">{source.title || 'Untitled source'}</div>
                          <div className="font-mono text-[10px] text-dim mt-1">
                            {source.domain} · TYPE: {(source.sourceType ?? 'unknown').toUpperCase()} · PUBLISHED: {source.publishedAt ? formatDate(source.publishedAt) : 'UNKNOWN'} · RETRIEVED: {formatDate(source.retrievedAt)}
                          </div>
                          {source.snippet && (
                            <div className="font-mono text-[10px] text-soft mt-2 leading-relaxed">"{truncate(source.snippet, 220)}"</div>
                          )}
                        </div>
                        <button
                          onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}
                          className="px-3 py-1.5 rounded-lg border border-white/10 font-mono text-[10px] text-soft hover:border-violet hover:text-violet transition-all cursor-pointer flex-shrink-0">
                          OPEN ↗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-noir p-5 font-mono text-xs text-dim">
                  {isComplete ? 'The targeted search returned no results — the source set is empty.' : 'No sources recorded yet.'}
                </div>
              )}
            </div>

            {/* Honest next-steps card — clearly labeled as future phases */}
            <div className="card-noir-violet p-6">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">WHAT HAPPENS NEXT</div>
              <div className="space-y-3">
                {[
                  'Evidence verification: each claim will be compared against the discovered sources.',
                  'Trust decision: the Trust Engine will produce a verdict and trust score from verified evidence.',
                  'Monitoring: saved investigations can be re-checked over time for changes.',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="font-mono text-xs text-violet flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-mono text-sm text-soft">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 font-mono text-[10px] text-dim">
                These steps arrive in later phases — Trustlify shows only what the evidence supports today.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}
