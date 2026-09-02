import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button, StatusBadge } from '@/components/ui'
import { useInvestigation } from '@/hooks/useInvestigation'
import { useUserProfile } from '@/hooks/useUserProfile'
import { apiFetch } from '@/lib/supabase'
import type {
  BadgeStatus,
  Claim,
  ClaimVerificationStatus,
  DeadlineState,
  EligibilityResult,
  Evidence,
  EvidenceRelation,
  IntelligenceSectionKey,
  OpportunityCurrencyState,
  RequirementCheck,
  SimilarOpportunitiesResult,
  Source,
  Verdict,
} from '@/types'
import {
  currencyLabel,
  deadlineLabel,
  eligibilityLabel,
  isRomanUrdu,
  outcomeLabel,
  ROMAN_URDU_SCOPE_NOTE,
  romanUrduBrief,
  sectionLabel,
  verdictLabel,
  dimensionRows,
  type DimensionRow,
} from '@/i18n/resultTemplates'

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

/* ─── Verdict presentation (deterministic backend verdict, spec 26-30) ─────── */

interface VerdictStyle {
  title: string
  badge: BadgeStatus
  color: string
  glow: string
  blurb: string
}

const VERDICT_STYLE: Record<Verdict, VerdictStyle> = {
  VERIFIED: {
    title: 'VERIFIED',
    badge: 'verified',
    color: 'text-lime',
    glow: '#A3FF12',
    blurb: 'The critical claims are supported by credible evidence, including at least one authoritative source.',
  },
  CAUTION: {
    title: 'CAUTION',
    badge: 'conflict',
    color: 'text-caution',
    glow: '#F5B942',
    blurb: 'Critical claims could not be fully confirmed, or the evidence conflicts. Verify before acting.',
  },
  HIGH_RISK: {
    title: 'HIGH RISK',
    badge: 'risk',
    color: 'text-danger',
    glow: '#FF4D5E',
    blurb: 'Strong risk signals were detected. Do not share personal information or make payments.',
  },
  UNVERIFIED: {
    title: 'UNVERIFIED',
    badge: 'neutral',
    color: 'text-soft',
    glow: '#A1A1AA',
    blurb: 'Not enough credible evidence was found to confirm or refute the critical claims.',
  },
}

const CLAIM_BADGE: Record<ClaimVerificationStatus, BadgeStatus> = {
  pending: 'pending',
  supported: 'verified',
  contradicted: 'risk',
  conflicting: 'conflict',
  insufficient: 'neutral',
  unsupported: 'conflict',
}

const RELATION_BADGE: Record<EvidenceRelation, BadgeStatus> = {
  supports: 'verified',
  contradicts: 'risk',
  neutral: 'neutral',
  insufficient: 'neutral',
}

const RELATION_LABEL: Record<EvidenceRelation, string> = {
  supports: 'SUPPORTS',
  contradicts: 'CONTRADICTS',
  neutral: 'NEUTRAL',
  insufficient: 'INSUFFICIENT',
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full max-w-xs h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  )
}

/* ─── Student intelligence presentation ────────────────────────────────────
 * All values below are derived deterministically by the backend from rows this
 * investigation already persisted. Nothing here re-judges the verdict.
 * ───────────────────────────────────────────────────────────────────────── */

const CURRENCY_STYLE: Record<OpportunityCurrencyState, { label: string; badge: BadgeStatus }> = {
  CURRENT: { label: 'CURRENT', badge: 'verified' },
  EXPIRED: { label: 'EXPIRED', badge: 'risk' },
  POSSIBLY_OUTDATED: { label: 'POSSIBLY OUTDATED', badge: 'conflict' },
  UNKNOWN: { label: 'CURRENCY UNKNOWN', badge: 'neutral' },
}

const DEADLINE_STYLE: Record<DeadlineState, { label: string; badge: BadgeStatus }> = {
  ACTIVE: { label: 'DEADLINE ACTIVE', badge: 'verified' },
  EXPIRED: { label: 'DEADLINE EXPIRED', badge: 'risk' },
  CONFLICTING: { label: 'DEADLINES CONFLICT', badge: 'conflict' },
  UNKNOWN: { label: 'DEADLINE UNKNOWN', badge: 'neutral' },
}

const ELIGIBILITY_STYLE: Record<
  EligibilityResult,
  { label: string; badge: BadgeStatus; color: string; glow: string }
> = {
  ELIGIBLE: { label: 'ELIGIBLE', badge: 'verified', color: 'text-lime', glow: '#A3FF12' },
  PARTIALLY_ELIGIBLE: { label: 'PARTIALLY ELIGIBLE', badge: 'conflict', color: 'text-caution', glow: '#F5B942' },
  NOT_ELIGIBLE: { label: 'NOT ELIGIBLE', badge: 'risk', color: 'text-danger', glow: '#FF4D5E' },
  INSUFFICIENT_DATA: { label: 'NOT ENOUGH DATA', badge: 'neutral', color: 'text-soft', glow: '#A1A1AA' },
}

function SectionTitle({ text, tone }: { text: string; tone: string }) {
  return <div className={`font-mono text-xs ${tone} tracking-wider mb-4`}>{text}</div>
}

/** Used when an investigation was stored before emphasis existed. */
const FALLBACK_SECTION_ORDER: IntelligenceSectionKey[] = [
  'currentness',
  'match',
  'recommendedSource',
  'verdictReasons',
  'actions',
]

/**
 * One row per profile dimension (final fix pass spec): the student sees what
 * was assessed and what the content simply never stated. The rows are rendered
 * straight from the engine's own breakdown — nothing is recomputed here, and a
 * “?” row is marked as not counted so it can never read as a hidden failure.
 */
function DimensionTable({ rows, title }: { rows: DimensionRow[]; title: string }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] text-dim tracking-wider">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.kind}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
          >
            <span className={`font-mono text-sm ${row.tone} flex-shrink-0 mt-0.5`}>{row.mark}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[10px] tracking-wider text-bone">{row.label}</span>
                <span className={`font-mono text-[9px] ${row.tone}`}>{row.stateLabel}</span>
                {!row.counted && (
                  <span className="font-mono text-[9px] text-dim">· NOT IN SCORE</span>
                )}
              </div>
              <div className="mt-1 font-mono text-[10px] leading-relaxed text-soft">{row.detail}</div>
              {row.source && (
                <div className="mt-1 font-mono text-[9px] text-dim">
                  FROM: "{truncate(row.source, 90)}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** ✓ / ✗ / ? lines — each one names the real requirement and the real profile fact. */
function CheckList({
  checks,
  mark,
  tone,
  title,
}: {
  checks: RequirementCheck[]
  mark: string
  tone: string
  title: string
}) {
  if (checks.length === 0) return null
  return (
    <div className="space-y-2">
      <div className={`font-mono text-[10px] ${tone} tracking-wider`}>{title}</div>
      {checks.map((check, i) => (
        <div key={`${check.kind}-${i}`} className="flex items-start gap-3">
          <span className={`font-mono text-sm ${tone} flex-shrink-0 mt-0.5`}>{mark}</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm text-bone leading-relaxed">{check.detail}</div>
            <div className="font-mono text-[10px] text-dim mt-1">
              {check.kind.toUpperCase()} · FROM: "{truncate(check.source, 110)}"
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function InvestigationResult() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { investigation, isLoading, error, notFound } = useInvestigation(id)
  // Only the persisted language preference is read here — this page never
  // changes it, and the translation itself is a static template table.
  const { profile } = useUserProfile()

  // Similar-opportunity discovery is user-triggered only: loading a result never
  // searches, and the response is held in memory (nothing is persisted).
  const [similar, setSimilar] = useState<SimilarOpportunitiesResult | null>(null)
  const [similarBusy, setSimilarBusy] = useState(false)
  const [similarError, setSimilarError] = useState<string | null>(null)

  /* SAVE & MONITOR — the persisted record, not a page navigation. */
  const [monitorState, setMonitorState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [monitorMessage, setMonitorMessage] = useState('')

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

  const claims: Claim[] = investigation?.claims ?? []
  const sources: Source[] = investigation?.sources ?? []
  const evidence: Evidence[] = investigation?.evidence ?? []
  const isFailed = investigation?.status === 'failed'
  const isComplete = investigation?.status === 'complete'
  const isRunning = investigation?.status === 'created' || investigation?.status === 'processing'

  const decision = investigation?.decision ?? null
  const verdict: Verdict | null =
    investigation?.verdict ?? decision?.verdict ?? null
  const trustScore: number | null =
    investigation?.trustScore ?? decision?.trustScore ?? null
  const style = verdict ? VERDICT_STYLE[verdict] : null

  const inputPreview = truncate(investigation?.inputText ?? '', 120)
  const intel = investigation?.studentIntelligence ?? null
  // Student steps are appended to the verdict's own action list, never replacing it
  const recommendedActions: string[] =
    intel?.recommendedActions?.length
      ? intel.recommendedActions
      : decision?.recommendedAction ?? []

  const roman = isRomanUrdu(profile.language)
  const isStudentUser = String(profile.role ?? '').toLowerCase() === 'student'
  const sectionOrder = intel?.emphasis?.length
    ? intel.emphasis
    : FALLBACK_SECTION_ORDER

  const findSimilar = async () => {
    if (!id || similarBusy) return
    setSimilarBusy(true)
    setSimilarError(null)
    try {
      const res = await apiFetch(`/api/investigations/${id}/similar`, { method: 'POST' })
      setSimilar(res.data as SimilarOpportunitiesResult)
    } catch (err) {
      setSimilarError(err instanceof Error ? err.message : 'Similar opportunities could not be loaded.')
    } finally {
      setSimilarBusy(false)
    }
  }

  /**
   * Store this investigation as a monitoring item and only then say so. The
   * request is the existing authenticated POST /api/monitoring; the service
   * re-activates an existing row instead of inserting a second one, so pressing
   * this twice cannot duplicate the record. Nothing is reported as saved until
   * the server has confirmed it.
   */
  const saveAndMonitor = async () => {
    if (!id || monitorState === 'saving' || monitorState === 'saved') return
    setMonitorState('saving')
    setMonitorMessage('')
    try {
      await apiFetch('/api/monitoring', {
        method: 'POST',
        body: JSON.stringify({ investigationId: id }),
      })
      setMonitorState('saved')
      setMonitorMessage('Saved. This investigation is now on your Monitoring page.')
    } catch (err) {
      setMonitorState('error')
      setMonitorMessage(
        err instanceof Error ? err.message : 'Monitoring could not be started. Please try again.',
      )
    }
  }

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <motion.div {...fade}>
            <div className="font-mono text-[10px] text-dim tracking-wider mb-6">
              INVESTIGATION · {(investigation?.id ?? '').toUpperCase().slice(0, 13)} · {formatDate(investigation?.createdAt)}
            </div>

            {/* ── Verdict hero (failed / running / complete) ── */}
            {isFailed ? (
              <div className="card-noir p-8 mb-6 relative overflow-hidden border-[rgba(255,77,94,0.25)]">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, #FF4D5E, transparent)', transform: 'translate(30%, -30%)' }} />
                <div className="font-mono text-xs text-dim tracking-wider mb-2">STATUS</div>
                <h1 className="font-display mb-3" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300 }}>
                  INVESTIGATION FAILED
                </h1>
                <p className="font-mono text-sm text-soft mb-6 max-w-lg">
                  {investigation?.errorMessage || 'The investigation could not be completed. Please try again.'}
                </p>
                <Button variant="lime" onClick={() => navigate('/investigate')}>NEW INVESTIGATION →</Button>
              </div>
            ) : isRunning ? (
              <div className="card-noir p-8 mb-6 relative overflow-hidden border-[rgba(124,58,237,0.25)]">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, #7C3AED, transparent)', transform: 'translate(30%, -30%)' }} />
                <div className="font-mono text-xs text-dim tracking-wider mb-2">STATUS</div>
                <h1 className="font-display mb-3" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300 }}>
                  INVESTIGATING
                </h1>
                <p className="font-mono text-sm text-soft mb-6 max-w-lg">
                  The investigation is still running. The verdict, trust score, and verified evidence appear here the
                  moment it completes — nothing on this page is a verdict until then.
                </p>
                <Button variant="violet" onClick={() => navigate(`/investigation/${id}/progress`)}>
                  VIEW LIVE PROGRESS →
                </Button>
              </div>
            ) : style && verdict ? (
              <div className="card-noir p-8 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${style.glow}, transparent)`, transform: 'translate(30%, -30%)' }} />
                <div className="font-mono text-xs text-dim tracking-wider mb-2">TRUST DECISION</div>
                <div className="flex flex-wrap items-end gap-8 mb-4">
                  <div>
                    <h1 className={`font-display ${style.color}`} style={{ fontSize: 'clamp(40px,6vw,72px)', fontWeight: 300, lineHeight: 1 }}>
                      {roman ? verdictLabel(verdict, true) : style.title}
                    </h1>
                    <div className="mt-3">
                      <StatusBadge status={style.badge} label={roman ? verdictLabel(verdict, true) : undefined} />
                    </div>
                  </div>
                  {trustScore !== null && (
                    <div className="min-w-[180px]">
                      <div className="font-mono text-[10px] text-dim mb-1">TRUST SCORE</div>
                      <div className="font-display text-5xl mb-2" style={{ fontWeight: 300 }}>
                        {trustScore}<span className="text-dim text-xl"> /100</span>
                      </div>
                      <ScoreBar score={trustScore} color={style.glow} />
                    </div>
                  )}
                </div>
                <p className="font-mono text-sm text-soft mb-4 max-w-lg leading-relaxed">
                  {decision?.explanation || style.blurb}
                </p>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <div className="font-mono text-[10px] text-dim mb-1">CLAIMS</div>
                    <div className="font-display text-4xl" style={{ fontWeight: 300 }}>{claims.length}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-dim mb-1">SOURCES</div>
                    <div className="font-display text-4xl" style={{ fontWeight: 300 }}>{sources.length}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-dim mb-1">EVIDENCE</div>
                    <div className="font-display text-4xl" style={{ fontWeight: 300 }}>{evidence.length}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] text-dim mb-1">INPUT</div>
                    <div className="font-mono text-sm text-bone uppercase mt-2">{investigation?.inputType ?? '—'}</div>
                  </div>
                </div>

                {/* URL fetch signals (spec 08/11) — signals, never automatically malicious */}
                {investigation?.inputType === 'url' && investigation.originalDomain && (
                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-2 font-mono text-[10px]">
                    <span className="text-dim">SUBMITTED DOMAIN:</span>
                    <span className="text-bone">{investigation.originalDomain}</span>
                    {investigation.domainChanged && investigation.finalDomain && (
                      <>
                        <span className="text-dim">→ FINAL DOMAIN:</span>
                        <span className="text-caution">{investigation.finalDomain}</span>
                        <span className="px-2 py-0.5 rounded-full border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.08)] text-caution">
                          DOMAIN CHANGED
                        </span>
                      </>
                    )}
                    {investigation.contentTruncated && (
                      <span className="px-2 py-0.5 rounded-full border border-white/15 bg-white/[0.04] text-dim">
                        CONTENT TRUNCATED
                      </span>
                    )}
                  </div>
                )}
                {inputPreview && (
                  <div className="mt-4 font-mono text-[10px] text-dim truncate">SUBMITTED: "{inputPreview}"</div>
                )}
              </div>
            ) : (
              <div className="card-noir p-8 mb-6">
                <div className="font-mono text-xs text-dim tracking-wider mb-2">STATUS</div>
                <h1 className="font-display mb-3" style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300 }}>
                  EVIDENCE COLLECTED
                </h1>
                <p className="font-mono text-sm text-soft max-w-lg">
                  {claims.length} claims and {sources.length} sources were recorded, but no trust decision was
                  persisted for this investigation.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-3">
              <Button variant="violet" onClick={() => navigate(`/investigation/${id}/evidence`)}>EVIDENCE GRAPH</Button>
              {!isRunning && !isFailed && (
                <Button
                  variant="outline"
                  onClick={saveAndMonitor}
                  disabled={monitorState === 'saving' || monitorState === 'saved'}
                >
                  {monitorState === 'saving'
                    ? 'SAVING…'
                    : monitorState === 'saved'
                      ? 'SAVED ✓'
                      : 'SAVE & MONITOR'}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
            </div>

            {/*
             * The honest outcome line. It states what was stored and what the
             * watch actually covers — a page left open is not monitoring, so no
             * promise of an alert is made here.
             */}
            {monitorMessage && (
              <div
                className={`mb-6 font-mono text-[10px] leading-relaxed ${
                  monitorState === 'error' ? 'text-danger' : 'text-lime'
                }`}
              >
                {monitorMessage}
                {monitorState === 'saved' && (
                  <>
                    {' '}Checks compare this investigation’s own recorded deadline with the
                    current date whenever the Monitoring page is opened; no alert can arrive
                    before that, because no background worker is deployed.
                    <button
                      onClick={() => navigate('/monitoring')}
                      className="ml-2 text-violet hover:text-[#A855F7] cursor-pointer"
                    >
                      OPEN MONITORING →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* You asked — the question is answered from this run's own outputs */}
            {intel?.question && (
              <div className="mb-8">
                <SectionTitle text={sectionLabel('youAsked', roman)} tone="text-violet" />
                <div className="card-noir-violet p-6">
                  <p
                    className="font-display text-lg text-bone leading-relaxed mb-4"
                    style={{ fontWeight: 300 }}
                  >
                    “{intel.question}”
                  </p>
                  {intel.answer.length > 0 && (
                    <div className="space-y-3">
                      {intel.answer.map((line, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="font-mono text-xs text-violet flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <span className="font-mono text-sm text-soft leading-relaxed">{line}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {intel.intent && (
                    <div className="mt-4 font-mono text-[10px] text-dim">
                      INTENT: {intel.intent} — matched by keyword rules, not by a model call.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Roman Urdu view — deterministic templates over the computed states. */}
            {roman && intel && (
              <div className="mb-8">
                <SectionTitle text="KHULASA (ROMAN URDU)" tone="text-lime" />
                <div className="card-noir p-6">
                  <div className="space-y-3">
                    {romanUrduBrief({
                      verdict,
                      eligibility: intel.studentMatch?.result ?? null,
                      blockers: intel.studentMatch?.missing.map((check) => check.kind) ?? [],
                      currency: intel.currentness.opportunity.state,
                      deadline: intel.currentness.deadline.state,
                    }).map((line, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="font-mono text-xs text-lime flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                        <span className="font-mono text-sm text-bone leading-relaxed">{line}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 font-mono text-[10px] text-dim leading-relaxed">
                    {ROMAN_URDU_SCOPE_NOTE}
                  </div>
                </div>
              </div>
            )}

            {/*
             * Question-aware presentation (spec 08). This wrapper opens here so
             * that every block below it — including BETTER MATCHES — obeys one
             * priority order: the blocks the backend's `emphasis` ranks come
             * first, and the opt-in recommendation CTA is deliberately placed
             * after them. A student who asked about eligibility gets their
             * answer above a button that offers to search for something else.
             */}
            <div className="flex flex-col">
            {/* Better matches — fetched only when the student presses the button. */}
            {isComplete && isStudentUser && (
              <div className="mb-8" style={{ order: sectionOrder.length + 1 }}>
                <SectionTitle text={sectionLabel('betterMatches', roman)} tone="text-violet" />
                <div className="card-noir p-6">
                  {similarBusy && (
                    <div className="font-mono text-xs text-dim animate-progress-pulse">
                      SEARCHING — MAX 2 QUERIES…
                    </div>
                  )}

                  {!similarBusy && !similar && (
                    <>
                      <p className="font-mono text-sm text-soft leading-relaxed mb-4">
                        Trustlify will not invent alternatives. This runs at most two searches on the
                        same provider the investigation already used, built from your profile and this
                        content by code — never by a model. It only runs because you asked.
                      </p>
                      <Button variant="violet" size="sm" onClick={findSimilar}>
                        {roman ? 'AUR MOUQE DIYEN' : 'FIND SIMILAR OPPORTUNITIES'}
                      </Button>
                    </>
                  )}

                  {similarError && (
                    <div className="font-mono text-[10px] text-danger">{similarError}</div>
                  )}

                  {similar && !similarBusy && (
                    <div className="space-y-1">
                      <div className="font-mono text-[10px] text-dim leading-relaxed mb-2">
                        {similar.searchesRun} SEARCH{similar.searchesRun === 1 ? '' : 'ES'} ·{' '}
                        {similar.items.length} SHOWN · {similar.filteredOut} FILTERED OUT
                      </div>
                      <div className="font-mono text-[10px] text-dim leading-relaxed mb-2">
                        QUERIES USED: {similar.queries.map((query) => `“${query}”`).join(' · ')}
                      </div>

                      {similar.items.length === 0 && (
                        <div className="font-mono text-xs text-caution">{similar.note}</div>
                      )}

                      {similar.items.map((item, i) => (
                        <div key={item.url} className="pt-4 mt-4 border-t border-white/[0.06]">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm text-bone">{item.title}</div>
                              <div className="font-mono text-[10px] text-dim mt-1">
                                {item.domain} · TYPE: {item.sourceType.toUpperCase()} · LEAD{' '}
                                {String(i + 1).padStart(2, '0')}
                              </div>
                            </div>
                            <button
                              onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                              className="px-3 py-1.5 rounded-lg border border-white/10 font-mono text-[10px] text-soft hover:border-violet hover:text-violet transition-all cursor-pointer flex-shrink-0">
                              OPEN
                            </button>
                          </div>

                          <div className="mt-2 space-y-1">
                            {item.why.map((reason, j) => (
                              <div key={j} className="font-mono text-[10px] text-soft leading-relaxed">
                                · {reason}
                              </div>
                            ))}
                          </div>

                          {item.deadlineIso && (
                            <div className="font-mono text-[10px] text-caution mt-2">
                              DEADLINE STATED IN RESULT: {formatDate(item.deadlineIso)}
                            </div>
                          )}

                          {item.match && (
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              <StatusBadge
                                status={ELIGIBILITY_STYLE[item.match.result].badge}
                                label={eligibilityLabel(item.match.result, roman)}
                              />
                              <span className="font-mono text-[10px] text-dim">
                                {item.match.matchScore !== null
                                  ? `${item.match.matchScore}/100 · `
                                  : ''}
                                from this listing’s own snippet text only
                              </span>
                            </div>
                          )}

                          {item.priorVerdict && (
                            <div className="font-mono text-[10px] text-lime mt-2">
                              ALREADY INVESTIGATED BY YOU: {item.priorVerdict}
                            </div>
                          )}
                        </div>
                      ))}

                      {similar.items.length > 0 && (
                        <div className="pt-4 mt-4 border-t border-white/[0.06] font-mono text-[10px] text-dim leading-relaxed">
                          {similar.note}
                        </div>
                      )}

                      <div className="pt-4 mt-4 border-t border-white/[0.06]">
                        <Button variant="outline" size="sm" onClick={findSimilar}>
                          {roman ? 'DOBARA DUNDEN' : 'SEARCH AGAIN'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/*
             * The blocks below are the same blocks, computed exactly as before.
             * `emphasis` only sets their visual priority, so the DOM order (and
             * every section) stays intact.
             *
             * Currentness + deadline — read from the dates the content actually states
             */}
            {intel && (
              <div className="mb-8" style={{ order: sectionOrder.indexOf('currentness') + 1 }}>
                <SectionTitle text={sectionLabel('currentness', roman)} tone="text-caution" />
                <div className="card-noir p-6 space-y-4">
                  <div>
                    <StatusBadge
                      status={CURRENCY_STYLE[intel.currentness.opportunity.state].badge}
                      label={currencyLabel(intel.currentness.opportunity.state, roman)}
                    />
                    <p className="font-mono text-sm text-soft leading-relaxed mt-2">
                      {intel.currentness.opportunity.detail}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge
                        status={DEADLINE_STYLE[intel.currentness.deadline.state].badge}
                        label={deadlineLabel(intel.currentness.deadline.state, roman)}
                      />
                      {intel.currentness.deadline.dates.length > 0 && (
                        <span className="font-mono text-[10px] text-dim">
                          DATES FOUND: {[
                            ...new Set(intel.currentness.deadline.dates.map((d) => d.iso)),
                          ]
                            .map((iso) => formatDate(iso))
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm text-soft leading-relaxed mt-2">
                      {intel.currentness.deadline.detail}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06]">
                    <div className="font-mono text-[10px] text-dim tracking-wider mb-2">SOURCE PUBLICATION DATES</div>
                    <p className="font-mono text-sm text-soft leading-relaxed">
                      Overall: {intel.currentness.sources.overall.toUpperCase()} ·{' '}
                      {intel.currentness.sources.perSource.filter((s) => s.status === 'recent').length} recent,
                      {' '}{intel.currentness.sources.perSource.filter((s) => s.status === 'dated').length} over a year old,
                      {' '}{intel.currentness.sources.perSource.filter((s) => s.status === 'unknown').length} undated
                      — an absent date is never treated as expired.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Student match — persisted profile vs. the requirements found in the claims */}
            {intel?.studentMatch && (() => {
              const match = intel.studentMatch!
              const look = ELIGIBILITY_STYLE[match.result]
              return (
                <div className="mb-8" style={{ order: sectionOrder.indexOf('match') + 1 }}>
                  <SectionTitle text={sectionLabel('studentMatch', roman)} tone={look.color} />
                  <div className="card-noir p-6">
                    <div className="flex flex-wrap items-end gap-8 mb-4">
                      <div>
                        <div className="font-mono text-[10px] text-dim mb-1">ELIGIBILITY (DETERMINISTIC COMPARISON)</div>
                        <h2 className={`font-display ${look.color}`} style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, lineHeight: 1 }}>
                          {eligibilityLabel(match.result, roman)}
                        </h2>
                        <div className="mt-3">
                          <StatusBadge status={look.badge} label={eligibilityLabel(match.result, roman)} />
                        </div>
                      </div>
                      {match.matchScore !== null && (
                        <div className="min-w-[180px]">
                          <div className="font-mono text-[10px] text-dim mb-1">MATCH SCORE</div>
                          <div className="font-display text-5xl mb-2" style={{ fontWeight: 300 }}>
                            {match.matchScore}<span className="text-dim text-xl"> /100</span>
                          </div>
                          <ScoreBar score={match.matchScore} color={look.glow} />
                          {/*
                           * The score's own basis, stated next to the number: an
                           * unstated or unverifiable requirement is not counted,
                           * so a student never reads a lower number as their own
                           * failure.
                           */}
                          {match.dimensions && match.dimensions.length > 0 && (
                            <div className="mt-2 font-mono text-[9px] text-dim leading-relaxed">
                              {match.dimensions.filter((d) => d.counted).length} counted ·{' '}
                              {match.dimensions.filter((d) => !d.counted).length} not counted in the score
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="font-mono text-sm text-soft leading-relaxed mb-5">{match.explanation}</p>

                    {/*
                     * What the comparison actually covered. Only shown when the
                     * engine sent a breakdown, so investigations stored before
                     * it existed render exactly as they did before.
                     */}
                    {match.dimensions && match.dimensions.length > 0 && (
                      <div className="mb-5">
                        <DimensionTable
                          rows={dimensionRows(match.dimensions, roman)}
                          title={sectionLabel('dimensionBreakdown', roman)}
                        />
                      </div>
                    )}

                    <div className="space-y-5">
                      {/*
                       * Spec 09: a deadline is a currency signal, not a quality of
                       * the student. The matcher already keeps it out of the score;
                       * it is also kept out of the profile-comparison lists so it can
                       * never read as a requirement the student satisfied or failed.
                       */}
                      {(() => {
                        const isDeadline = (check: RequirementCheck) => check.kind === 'deadline'
                        const timing = [
                          ...match.matched.filter(isDeadline),
                          ...match.missing.filter(isDeadline),
                          ...match.unknown.filter(isDeadline),
                        ]
                        return (
                          <>
                            <CheckList
                              checks={match.matched.filter((check) => !isDeadline(check))}
                              mark="✓"
                              tone="text-lime"
                              title={outcomeLabel('MATCHED', roman)}
                            />
                            <CheckList
                              checks={match.missing.filter((check) => !isDeadline(check))}
                              mark="✗"
                              tone="text-danger"
                              title={outcomeLabel('MISSING', roman)}
                            />
                            <CheckList
                              checks={match.unknown.filter((check) => !isDeadline(check))}
                              mark="?"
                              tone="text-caution"
                              title={outcomeLabel('UNKNOWN', roman)}
                            />
                            <CheckList
                              checks={timing}
                              mark="·"
                              tone="text-caution"
                              title={outcomeLabel('TIMING', roman)}
                            />
                          </>
                        )
                      })()}
                    </div>

                    {/* What the student’s own public page added — or why it could not. */}
                    {intel.publicProfile && (
                      <div className="mt-5 pt-4 border-t border-white/[0.06]">
                        <div className="font-mono text-[10px] text-dim tracking-wider mb-2">
                          PUBLIC PORTFOLIO EVIDENCE
                          {intel.publicProfile.domain ? ` · ${intel.publicProfile.domain}` : ''}
                          {intel.publicProfile.fetchedAt ? ` · READ ${formatDate(intel.publicProfile.fetchedAt)}` : ''}
                        </div>
                        {intel.publicProfile.status === 'AVAILABLE' ? (
                          <div className="font-mono text-[10px] text-soft leading-relaxed">
                            {intel.publicProfile.skills.length > 0 && (
                              <div>Skills seen on the page: {intel.publicProfile.skills.join(', ')}.</div>
                            )}
                            {intel.publicProfile.fields.length > 0 && (
                              <div>Fields seen: {intel.publicProfile.fields.join(', ')}.</div>
                            )}
                            {intel.publicProfile.skills.length === 0 && intel.publicProfile.fields.length === 0 && (
                              <div>No comparable skill or field statement was found in its visible text.</div>
                            )}
                          </div>
                        ) : (
                          <div className="font-mono text-[10px] text-caution leading-relaxed">
                            {intel.publicProfile.reason || 'The linked page could not be read.'}
                          </div>
                        )}
                        <div className="mt-2 font-mono text-[10px] text-dim leading-relaxed">
                          {intel.publicProfile.note}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-white/[0.06] font-mono text-[10px] text-dim leading-relaxed">
                      Compared against your saved student profile only. Trustlify does not invent a GPA, a document
                      or an answer the content never stated — unconfirmed requirements stay marked “?”.
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Recommended source — deterministic preference order over collected sources */}
            {intel && (
              <div className="mb-8" style={{ order: sectionOrder.indexOf('recommendedSource') + 1 }}>
                <SectionTitle text={sectionLabel('recommendedSource', roman)} tone="text-lime" />
                {intel.recommendedSource ? (
                  <div className="card-noir p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-bone truncate">
                          {intel.recommendedSource.title || intel.recommendedSource.domain}
                        </div>
                        <div className="font-mono text-[10px] text-dim mt-1">
                          {intel.recommendedSource.domain} · TYPE: {intel.recommendedSource.sourceType.toUpperCase()} ·{' '}
                          {intel.recommendedSource.tier.toUpperCase()} PICK
                          {intel.recommendedSource.strongestConfidence
                            ? ` · STRONGEST EXCERPT CONFIDENCE: ${intel.recommendedSource.strongestConfidence.toUpperCase()}`
                            : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => window.open(intel.recommendedSource!.url, '_blank', 'noopener,noreferrer')}
                        className="px-3 py-1.5 rounded-lg border border-white/10 font-mono text-[10px] text-soft hover:border-violet hover:text-violet transition-all cursor-pointer flex-shrink-0">
                        OPEN ↗
                      </button>
                    </div>
                    <p className="font-mono text-sm text-soft leading-relaxed mt-4">{intel.recommendedSource.why}</p>
                  </div>
                ) : (
                  <div className="card-noir p-5 font-mono text-xs text-dim">
                    No collected source was strong enough for Trustlify to recommend — it will not point you at a
                    random link.
                  </div>
                )}
              </div>
            )}

            {/* Why this verdict — deterministic reasons (spec 29) */}
            {decision && decision.reasons.length > 0 && (
              <div className="mb-8" style={{ order: sectionOrder.indexOf('verdictReasons') + 1 }}>
                <div className="font-mono text-xs text-caution tracking-wider mb-4">
                  {sectionLabel('whyVerdict', roman)}
                </div>
                <div className="card-noir p-6 space-y-3">
                  {decision.reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="font-mono text-xs text-caution flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-mono text-sm text-soft leading-relaxed">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended action (spec 30) — verdict action plus deterministic student steps */}
            {recommendedActions.length > 0 && (
              <div
                className="card-noir-violet p-6 mb-8"
                style={{ order: sectionOrder.indexOf('actions') + 1 }}
              >
                <div className="font-mono text-xs text-violet tracking-wider mb-3">
                  {sectionLabel('recommendedAction', roman)}
                </div>
                <div className="space-y-2">
                  {recommendedActions.map((action, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="font-mono text-xs text-violet flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <p className="font-mono text-sm text-bone leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>
            {/* /question-aware presentation wrapper */}

            {/* Claims — real, deterministically verified */}
            <div className="mb-8">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">
                {sectionLabel('claims', roman)}
              </div>
              {claims.length > 0 ? (
                <div className="space-y-2">
                  {claims.map((claim) => {
                    const badge = CLAIM_BADGE[claim.status ?? 'pending'] ?? 'pending'
                    return (
                      <div key={claim.id} className="card-noir p-5">
                        <div className="flex items-start gap-4">
                          <StatusBadge status={badge} label={(claim.status ?? 'pending').toUpperCase()} />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm text-bone leading-relaxed">{claim.text}</div>
                            {claim.reasoningSummary && (
                              <div className="font-mono text-[10px] text-soft mt-2 leading-relaxed">{claim.reasoningSummary}</div>
                            )}
                            <div className="font-mono text-[10px] text-dim mt-2">
                              TYPE: {claim.type.replace(/_/g, ' ').toUpperCase()} · IMPORTANCE: {claim.importance.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="card-noir p-5 font-mono text-xs text-dim">No claims were recorded.</div>
              )}
            </div>

            {/* Verified evidence — every excerpt checked against real source content */}
            <div className="mb-8">
              <div className="font-mono text-xs text-lime tracking-wider mb-4">
                {sectionLabel('evidence', roman)}
              </div>
              {evidence.length > 0 ? (
                <div className="space-y-2">
                  {evidence.map((item) => {
                    const claim = claims.find((c) => c.id === item.claimId)
                    const source = sources.find((s) => s.id === item.sourceId)
                    return (
                      <div key={item.id} className="card-noir p-5">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] text-dim mb-1 truncate">
                              CLAIM: {claim ? truncate(claim.text, 80) : item.claimId}
                            </div>
                            <div className="font-mono text-[10px] text-dim">
                              SOURCE: {source ? source.domain || truncate(source.url, 40) : item.sourceId}
                              {' · '}CONFIDENCE: {(item.confidence ?? '—').toString().toUpperCase()}
                              {' · '}EXCERPT: {item.verificationStatus === 'approved' ? 'VERIFIED' : 'UNVERIFIED'}
                            </div>
                          </div>
                          <StatusBadge
                            status={RELATION_BADGE[item.relation] ?? 'neutral'}
                            label={RELATION_LABEL[item.relation] ?? item.relation.toUpperCase()}
                          />
                        </div>
                        {item.excerpt && (
                          <div className="font-display text-sm text-bone leading-relaxed italic" style={{ fontWeight: 300 }}>
                            "{item.excerpt}"
                          </div>
                        )}
                        {item.reason && (
                          <div className="font-mono text-[10px] text-soft mt-2 leading-relaxed">{item.reason}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="card-noir p-5 font-mono text-xs text-dim">
                  {isComplete
                    ? 'No verifiable evidence was produced — every excerpt is checked against real source content, and nothing was invented.'
                    : 'No evidence recorded yet.'}
                </div>
              )}
            </div>

            {/* Sources — real, conservatively classified */}
            <div className="mb-8">
              <div className="font-mono text-xs text-lime tracking-wider mb-4">
                {sectionLabel('sources', roman)}
              </div>
              {sources.length > 0 ? (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div key={source.id} className="card-noir p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-bone truncate">{source.title || 'Untitled source'}</div>
                          <div className="font-mono text-[10px] text-dim mt-1">
                            {source.domain} · TYPE: {(source.sourceType ?? 'unknown').toUpperCase()}
                            {' · '}PUBLISHED: {source.publishedAt ? formatDate(source.publishedAt) : 'UNKNOWN'}
                            {' · '}RETRIEVED: {formatDate(source.retrievedAt)}
                            {source.accessStatus ? ` · ACCESS: ${source.accessStatus.toUpperCase()}` : ''}
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
                  {isComplete ? 'The targeted searches returned no results — the source set is empty.' : 'No sources recorded yet.'}
                </div>
              )}
            </div>

            {/* Honest method note — how the verdict was produced */}
            <div className="card-noir-violet p-6">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">HOW THIS VERDICT WAS PRODUCED</div>
              <div className="space-y-3">
                {[
                  'AI extracted the claims from your input and compared them against fetched source content — nothing else.',
                  'Every quoted excerpt was verified against the real source text; unverifiable quotes were downgraded or rejected.',
                  'The verdict, trust score, and reasons were computed by deterministic code — never by the AI.',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="font-mono text-xs text-violet flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-mono text-sm text-soft">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 font-mono text-[10px] text-dim">
                Monitoring saved investigations over time arrives in a later phase — Trustlify shows only what the
                evidence supports today.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}
