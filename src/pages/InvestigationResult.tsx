import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/AppShell'
import { Button, StatusBadge } from '@/components/ui'
import { useInvestigation } from '@/hooks/useInvestigation'
import type {
  BadgeStatus,
  Claim,
  ClaimVerificationStatus,
  DeadlineState,
  EligibilityResult,
  Evidence,
  EvidenceRelation,
  OpportunityCurrencyState,
  RequirementCheck,
  Source,
  Verdict,
} from '@/types'

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

/** ✓ / ✗ / ? lines — each one names the real requirement and the real profile fact. */
function CheckList({ checks, mark, tone }: { checks: RequirementCheck[]; mark: string; tone: string }) {
  if (checks.length === 0) return null
  return (
    <div className="space-y-2">
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
                      {style.title}
                    </h1>
                    <div className="mt-3">
                      <StatusBadge status={style.badge} />
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
            <div className="flex flex-wrap gap-3 mb-8">
              <Button variant="violet" onClick={() => navigate(`/investigation/${id}/evidence`)}>EVIDENCE GRAPH</Button>
              {!isRunning && !isFailed && (
                <Button variant="outline" onClick={() => navigate('/monitoring')}>SAVE & MONITOR</Button>
              )}
              <Button variant="outline" onClick={() => navigate('/investigate')}>NEW INVESTIGATION</Button>
            </div>

            {/* You asked — the question is answered from this run's own outputs */}
            {intel?.question && (
              <div className="mb-8">
                <SectionTitle text="YOU ASKED" tone="text-violet" />
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

            {/* Currentness + deadline — read from the dates the content actually states */}
            {intel && (
              <div className="mb-8">
                <SectionTitle text="CURRENTNESS" tone="text-caution" />
                <div className="card-noir p-6 space-y-4">
                  <div>
                    <StatusBadge
                      status={CURRENCY_STYLE[intel.currentness.opportunity.state].badge}
                      label={CURRENCY_STYLE[intel.currentness.opportunity.state].label}
                    />
                    <p className="font-mono text-sm text-soft leading-relaxed mt-2">
                      {intel.currentness.opportunity.detail}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06]">
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge
                        status={DEADLINE_STYLE[intel.currentness.deadline.state].badge}
                        label={DEADLINE_STYLE[intel.currentness.deadline.state].label}
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
                <div className="mb-8">
                  <SectionTitle text="STUDENT MATCH" tone={look.color} />
                  <div className="card-noir p-6">
                    <div className="flex flex-wrap items-end gap-8 mb-4">
                      <div>
                        <div className="font-mono text-[10px] text-dim mb-1">ELIGIBILITY (DETERMINISTIC COMPARISON)</div>
                        <h2 className={`font-display ${look.color}`} style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 300, lineHeight: 1 }}>
                          {look.label}
                        </h2>
                        <div className="mt-3">
                          <StatusBadge status={look.badge} label={look.label} />
                        </div>
                      </div>
                      {match.matchScore !== null && (
                        <div className="min-w-[180px]">
                          <div className="font-mono text-[10px] text-dim mb-1">MATCH SCORE</div>
                          <div className="font-display text-5xl mb-2" style={{ fontWeight: 300 }}>
                            {match.matchScore}<span className="text-dim text-xl"> /100</span>
                          </div>
                          <ScoreBar score={match.matchScore} color={look.glow} />
                        </div>
                      )}
                    </div>

                    <p className="font-mono text-sm text-soft leading-relaxed mb-5">{match.explanation}</p>

                    <div className="space-y-5">
                      <CheckList checks={match.matched} mark="✓" tone="text-lime" />
                      <CheckList checks={match.missing} mark="✗" tone="text-danger" />
                      <CheckList checks={match.unknown} mark="?" tone="text-caution" />
                    </div>

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
              <div className="mb-8">
                <SectionTitle text="RECOMMENDED SOURCE" tone="text-lime" />
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
              <div className="mb-8">
                <div className="font-mono text-xs text-caution tracking-wider mb-4">WHY THIS VERDICT</div>
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
              <div className="card-noir-violet p-6 mb-8">
                <div className="font-mono text-xs text-violet tracking-wider mb-3">RECOMMENDED ACTION</div>
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

            {/* Claims — real, deterministically verified */}
            <div className="mb-8">
              <div className="font-mono text-xs text-violet tracking-wider mb-4">EXTRACTED CLAIMS</div>
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
              <div className="font-mono text-xs text-lime tracking-wider mb-4">VERIFIED EVIDENCE</div>
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
              <div className="font-mono text-xs text-lime tracking-wider mb-4">DISCOVERED SOURCES</div>
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
