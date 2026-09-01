import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { useInvestigation, stagesForInput, stageIndexOf } from '@/hooks/useInvestigation'

type StageStatus = 'done' | 'active' | 'pending' | 'failed'

const statusConfig: Record<StageStatus, { color: string; icon: string; bg: string; border: string }> = {
  done: { color: 'text-lime', icon: '✓', bg: 'bg-lime-dim', border: 'border-[rgba(163,255,18,0.25)]' },
  active: { color: 'text-violet', icon: '●', bg: 'bg-[rgba(124,58,237,0.1)]', border: 'border-[rgba(124,58,237,0.4)]' },
  pending: { color: 'text-dim', icon: '○', bg: 'bg-transparent', border: 'border-white/[0.06]' },
  failed: { color: 'text-danger', icon: '✕', bg: 'bg-[rgba(255,77,94,0.06)]', border: 'border-[rgba(255,77,94,0.25)]' },
}

/** Real, per-stage detail derived from backend state — never invented. */
function stageDetail(
  stageId: string,
  data: {
    claimCount: number
    sourceCount: number
    evidenceCount: number
    searchQueries: string[]
    verdict: string | null
    domainChanged: boolean
    inputType: string
  },
): string | null {
  if (stageId === 'EXTRACTING_CONTENT' && data.inputType === 'url') {
    return data.domainChanged
      ? 'Page fetched — the final domain differs from the submitted one (recorded as a signal)'
      : 'Page fetched and converted to readable text'
  }
  if (stageId === 'EXTRACTING_CLAIMS' && data.claimCount > 0) {
    return `${data.claimCount} claim${data.claimCount === 1 ? '' : 's'} extracted`
  }
  if (stageId === 'SEARCHING' && data.searchQueries.length > 0) {
    return `Queries: ${data.searchQueries.map((q) => `"${q}"`).join(' · ')}`
  }
  if (stageId === 'READING_SOURCES' && data.sourceCount > 0) {
    return `${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'} recorded`
  }
  if (stageId === 'READING_SOURCES' && data.sourceCount === 0 && data.searchQueries.length > 0) {
    return 'Search returned no results — recorded as an empty source set'
  }
  if (stageId === 'ANALYZING_EVIDENCE' && data.evidenceCount > 0) {
    return `${data.evidenceCount} evidence item${data.evidenceCount === 1 ? '' : 's'} verified against source content`
  }
  if (stageId === 'CALCULATING_TRUST' && data.verdict) {
    return `Verdict computed: ${data.verdict}`
  }
  return null
}

export default function InvestigationProgress() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { investigation, isLoading, error, notFound } = useInvestigation(id)

  /* Real elapsed wall-clock time while the investigation runs */
  const [elapsed, setElapsed] = useState(0)
  const isRunning = investigation?.status === 'processing' || investigation?.status === 'created'
  useEffect(() => {
    if (!investigation || !isRunning) return
    const started = Date.now() - elapsed * 1000
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigation?.id, isRunning])

  const status = investigation?.status
  const isComplete = status === 'complete'
  const isFailed = status === 'failed'
  const stages = stagesForInput(investigation?.inputType)
  const stageIndex = stageIndexOf(investigation?.currentStage, stages)
  const claimCount = investigation?.claims.length ?? 0
  const sourceCount = investigation?.sources.length ?? 0
  const evidenceCount = investigation?.evidence.length ?? 0
  const searchQueries = investigation?.searchQueries ?? (investigation?.searchQuery ? [investigation.searchQuery] : [])
  const verdict = investigation?.verdict ?? null

  const getStatus = (i: number): StageStatus => {
    if (isFailed) return i < stageIndex ? 'done' : i === stageIndex ? 'failed' : 'pending'
    if (isComplete) return 'done'
    if (i < stageIndex) return 'done'
    if (i === stageIndex) return 'active'
    return 'pending'
  }

  const inputPreview = (investigation?.inputText ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)

  /* ─── Loading / error states ─────────────────────────────────────────── */

  if (isLoading && !investigation) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center px-4">
          <div className="font-mono text-xs text-dim animate-progress-pulse">LOADING INVESTIGATION…</div>
        </div>
      </AppShell>
    )
  }

  if (notFound || (!investigation && error)) {
    return (
      <AppShell>
        <div className="pt-16 min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-lg text-center py-20">
            <div className="font-mono text-xs text-danger mb-3">INVESTIGATION NOT FOUND</div>
            <p className="font-mono text-[11px] text-dim mb-6">
              {error || 'This investigation does not exist or you do not have access to it.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className="font-mono text-[10px] text-dim tracking-wider mb-2">
              INVESTIGATION · {(investigation?.id ?? '').toUpperCase().slice(0, 13)}
            </div>
            <h1 className="font-display mb-3" style={{ fontSize: 36, fontWeight: 300 }}>
              {isComplete ? 'Investigation Complete' : isFailed ? 'Investigation Failed' : 'Investigating...'}
            </h1>
            {inputPreview && (
              <div className="font-mono text-xs text-dim max-w-sm mx-auto truncate">"{inputPreview}"</div>
            )}
          </motion.div>

          {/* Stages */}
          <div className="relative">
            <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: 'linear-gradient(to bottom, rgba(124,58,237,0.5), rgba(163,255,18,0.3))' }} />
            <div className="space-y-3">
              <AnimatePresence>
                {stages.map((stage, i) => {
                  const st = getStatus(i)
                  const cfg = statusConfig[st]
                  const reached = isComplete || i <= stageIndex
                  const detail = stageDetail(stage.id, {
                    claimCount,
                    sourceCount,
                    evidenceCount,
                    searchQueries,
                    verdict,
                    domainChanged: investigation?.domainChanged ?? false,
                    inputType: investigation?.inputType ?? 'text',
                  })
                  return (
                    <motion.div key={stage.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: reached ? 1 : 0.3, x: reached ? 0 : -4 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                      className={`flex items-start gap-5 p-4 rounded-xl border transition-all duration-500 ${cfg.bg} ${cfg.border}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ring-4 ring-void transition-all ${
                        st === 'done' ? 'bg-lime'
                        : st === 'active' ? 'bg-violet animate-progress-pulse'
                        : st === 'failed' ? 'bg-danger'
                        : 'bg-dim/40'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-medium ${cfg.color}`}>{stage.label}</span>
                          {st === 'active' && <span className="font-mono text-[9px] text-violet animate-progress-pulse">RUNNING</span>}
                        </div>
                        {reached && (
                          <div className="font-mono text-[10px] text-dim mt-0.5">{detail ?? stage.desc}</div>
                        )}
                      </div>
                      <span className={`font-mono text-sm flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Failure callout — real, backend-provided reason */}
          <AnimatePresence>
            {isFailed && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-6 p-4 rounded-xl border border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.05)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-danger text-xs">⚠</span>
                  <span className="font-mono text-xs text-danger">INVESTIGATION FAILED</span>
                </div>
                <p className="font-mono text-[10px] text-soft">
                  {investigation?.errorMessage || 'The investigation could not be completed. Please try again.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Polling connection error (distinct from investigation failure) */}
          <AnimatePresence>
            {error && !isFailed && !notFound && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 rounded-xl border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.05)]">
                <p className="font-mono text-[10px] text-soft">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isComplete && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
                <div className="font-mono text-[10px] text-lime tracking-wider mb-4">
                  INVESTIGATION COMPLETE · {claimCount} CLAIMS · {sourceCount} SOURCES · {evidenceCount} EVIDENCE{verdict ? ` · ${verdict}` : ''} · {elapsed}s
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="lime" size="lg" onClick={() => navigate(`/investigation/${id}`)}>VIEW RESULTS →</Button>
                  <Button variant="outline" onClick={() => navigate(`/investigation/${id}/evidence`)}>EVIDENCE GRAPH</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isFailed && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="lime" size="lg" onClick={() => navigate('/investigate')}>NEW INVESTIGATION →</Button>
                  <Button variant="outline" onClick={() => navigate(`/investigation/${id}/evidence`)}>VIEW COLLECTED DATA</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  )
}
