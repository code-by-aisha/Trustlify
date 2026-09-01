/* ─── TRUSTLIFY TYPE DEFINITIONS ─────────────────────────────────────────── */

/** Primary verdict states shown to the user */
export type Verdict = 'VERIFIED' | 'CAUTION' | 'HIGH_RISK' | 'UNVERIFIED'

/** Internal secondary classifications */
export type Classification =
  | 'IMPERSONATED'
  | 'OUTDATED'
  | 'CONFLICTING'
  | 'MISSING_EVIDENCE'
  | 'UNSUITABLE'
  | 'HIGH_RISK'
  | 'VERIFIED'

/** Source authority tiers */
export type SourceTier = 1 | 2 | 3 | 4

/** Source types */
export type SourceType =
  | 'submitted'
  | 'official'
  | 'government'
  | 'academic'
  | 'institution'
  | 'news'
  | 'independent'
  | 'fact_check'
  | 'community'
  | 'user_submitted'
  | 'social'
  | 'unknown'

/** Evidence relation to a claim */
export type EvidenceRelation = 'supports' | 'contradicts' | 'neutral' | 'insufficient'

/** Investigation lifecycle status (backend is authoritative) */
export type InvestigationStatus = 'created' | 'processing' | 'complete' | 'failed'

/** Investigation stages — the real evidence-driven pipeline (backend spec 32) */
export type InvestigationStage =
  | 'NORMALIZING'
  | 'EXTRACTING_CONTENT'
  | 'EXTRACTING_CLAIMS'
  | 'SEARCHING'
  | 'READING_SOURCES'
  | 'ANALYZING_EVIDENCE'
  | 'CALCULATING_TRUST'
  | 'COMPLETE'

/** Input types */
export type InputType = 'url' | 'text' | 'image' | 'pdf'

/** Status badge variants */
export type BadgeStatus = 'verified' | 'conflict' | 'risk' | 'pending' | 'neutral'

/** Student match field result */
export type MatchResult = 'MATCH' | 'MISMATCH' | 'UNKNOWN'

/** Overall match strength */
export type MatchStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'UNCLEAR'

/** Risk level */
export type RiskLevel = 'low' | 'medium' | 'high'

/* ─── DATA MODELS ────────────────────────────────────────────────────────── */

/** Deterministic claim verification status (backend spec 23) */
export type ClaimVerificationStatus =
  | 'pending'
  | 'supported'
  | 'contradicted'
  | 'conflicting'
  | 'insufficient'
  | 'unsupported'

export interface Claim {
  id: string
  text: string
  type: string
  importance: 'critical' | 'important' | 'supporting'
  status?: ClaimVerificationStatus
  reasoningSummary?: string
  createdAt?: string
}

export interface Source {
  id: string
  investigationId: string
  url: string
  title: string
  domain: string
  sourceType: SourceType
  /** Untrusted search-result snippet — inert data, not evidence */
  snippet?: string
  publisher?: string
  publishedAt?: string
  updatedAt?: string
  retrievedAt: string
  createdAt?: string
  authorityLevel?: SourceTier
  accessStatus?: 'available' | 'restricted' | 'unavailable' | 'error' | 'ok' | 'blocked' | 'timeout' | 'not_found'
}

export interface Evidence {
  id: string
  claimId: string
  sourceId: string
  excerpt: string
  relation: EvidenceRelation
  /** Model's stated reason for the relation (inert text, excerpt is what matters) */
  reason?: string | null
  confidence?: 'high' | 'medium' | 'low' | null
  exactLocation?: string
  retrievedAt?: string
  createdAt?: string
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'approved' | 'uncertain'
}

/** The deterministic Trust Engine decision (backend spec 26-30) */
export interface TrustDecision {
  verdict: Verdict
  trustScore: number
  explanation: string | null
  recommendedAction: string[]
  reasons: string[]
  createdAt: string
}

export interface Investigation {
  id: string
  userId?: string
  inputType: InputType
  inputText?: string
  inputFileUrl?: string
  status: InvestigationStatus
  currentStage?: InvestigationStage
  verdict?: Verdict
  trustScore?: number
  searchQuery?: string | null
  searchQueries?: string[]
  selectedClaimId?: string | null
  errorMessage?: string | null
  /** URL fetch signals (backend spec 08/11) — a signal, never automatically malicious */
  originalUrl?: string | null
  finalUrl?: string | null
  originalDomain?: string | null
  finalDomain?: string | null
  domainChanged?: boolean
  contentTruncated?: boolean
  claims: Claim[]
  sources: Source[]
  evidence: Evidence[]
  /** Persisted Trust Engine decision — null while the investigation runs */
  decision?: TrustDecision | null
  events?: InvestigationEvent[]
  /** Optional question the user attached — never merged into inputText */
  investigationQuestion?: string | null
  /** Derived read-time from persisted rows — null until the run completes */
  studentIntelligence?: StudentIntelligence | null
  createdAt: string
  updatedAt: string
}

/* ─── STUDENT INTELLIGENCE ─────────────────────────────────────────────────
 * Mirrors the backend derivation (services/studentIntelligenceService.ts).
 * Every value here is computed deterministically from data the investigation
 * already stored — no model output is repackaged as a decision.
 * ───────────────────────────────────────────────────────────────────────── */

export type InvestigationIntent =
  | 'ELIGIBILITY'
  | 'CURRENTNESS'
  | 'DEADLINE'
  | 'LEGITIMACY'
  | 'EXPLANATION'
  | 'SIMILAR_OPPORTUNITIES'
  | 'GENERAL'

/**
 * Order in which the interpretation blocks are presented, chosen deterministically
 * from the intent. The raw claims/evidence/sources appendix is never reordered.
 */
export type IntelligenceSectionKey =
  | 'currentness'
  | 'match'
  | 'recommendedSource'
  | 'verdictReasons'
  | 'actions'

export type PublicProfileStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_PROVIDED'

/** Supplementary facts read from the student's own PUBLIC portfolio page. */
export interface PublicProfileEvidence {
  url: string | null
  domain: string | null
  status: PublicProfileStatus
  reason: string | null
  fetchedAt: string | null
  skills: string[]
  fields: string[]
  educationLines: string[]
  projectLines: string[]
  certificationLines: string[]
  experienceYears: number | null
  note: string
}

export type RequirementKind =
  | 'country'
  | 'age'
  | 'education'
  | 'field'
  | 'gpa'
  | 'skills'
  | 'experience'
  | 'language'
  | 'deadline'

export type RequirementOutcome = 'MATCHED' | 'MISSING' | 'UNKNOWN'

export interface RequirementCheck {
  kind: RequirementKind
  /** The real claim text the requirement was read from */
  source: string
  outcome: RequirementOutcome
  /** What was actually compared against the profile */
  detail: string
  hard: boolean
}

export type EligibilityResult =
  | 'ELIGIBLE'
  | 'PARTIALLY_ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'INSUFFICIENT_DATA'

/** Distinct from the legacy per-field StudentMatchResult demo type. */
export interface EligibilityMatch {
  result: EligibilityResult
  /** 0–100, or null when nothing could be checked */
  matchScore: number | null
  matched: RequirementCheck[]
  missing: RequirementCheck[]
  unknown: RequirementCheck[]
  explanation: string
}

export type DeadlineState = 'ACTIVE' | 'EXPIRED' | 'CONFLICTING' | 'UNKNOWN'

export interface DeadlineDate {
  claimId: string
  iso: string
}

export interface DeadlineAssessment {
  state: DeadlineState
  dates: DeadlineDate[]
  detail: string
}

export type OpportunityCurrencyState =
  | 'CURRENT'
  | 'EXPIRED'
  | 'POSSIBLY_OUTDATED'
  | 'UNKNOWN'

export interface OpportunityCurrency {
  state: OpportunityCurrencyState
  detail: string
}

export type SourceCurrentnessStatus = 'recent' | 'dated' | 'unknown'

export interface SourceCurrentness {
  sourceId: string
  status: SourceCurrentnessStatus
  publishedAt: string | null
  retrievedAt: string
  ageDays: number | null
}

export interface InvestigationCurrentness {
  overall: 'recent' | 'dated' | 'mixed' | 'unknown'
  perSource: SourceCurrentness[]
}

export interface RecommendedSource {
  sourceId: string
  url: string
  title: string
  domain: string
  sourceType: string
  tier: 'authoritative' | 'primary' | 'independent'
  why: string
  supportingExcerpts: number
  contradictingExcerpts: number
  strongestConfidence: 'high' | 'medium' | 'low' | null
  contentAvailable: boolean
}

export interface StudentIntelligence {
  question: string | null
  intent: InvestigationIntent | null
  answer: string[]
  /** Presentation order for the blocks below — driven by `intent`. */
  emphasis: IntelligenceSectionKey[]
  currentness: {
    opportunity: OpportunityCurrency
    deadline: DeadlineAssessment
    sources: InvestigationCurrentness
  }
  /** Null for non-students — the comparison needs a real student profile */
  studentMatch: EligibilityMatch | null
  recommendedSource: RecommendedSource | null
  recommendedActions: string[]
  /** Null unless the student saved a public portfolio URL. */
  publicProfile: PublicProfileEvidence | null
}

/* ─── Similar opportunities (user-triggered, never part of a run) ─────────── */

export interface SimilarOpportunityMatch {
  result: EligibilityResult
  matchScore: number | null
  checks: RequirementCheck[]
  /** Says out loud how thin the input was. */
  basis: 'search snippet'
}

export interface SimilarOpportunity {
  title: string
  url: string
  domain: string
  sourceType: string
  why: string[]
  match: SimilarOpportunityMatch | null
  deadlineIso: string | null
  deadlineDetail: string | null
  priorVerdict: string | null
}

export interface SimilarOpportunitiesResult {
  items: SimilarOpportunity[]
  queries: string[]
  searchesRun: number
  filteredOut: number
  note: string
}

/** Internal investigation event types (derived from persisted rows) */
export type InvestigationEventType =
  | 'STAGE_CHANGED'
  | 'CLAIM_CREATED'
  | 'SOURCE_DISCOVERED'
  | 'EVIDENCE_FOUND'
  | 'INVESTIGATION_COMPLETED'
  | 'INVESTIGATION_FAILED'

export interface InvestigationEvent {
  type: InvestigationEventType
  investigationId: string
  timestamp: string
  claimId?: string
  sourceId?: string
  stage?: string
  reason?: string
}

export interface StudentProfile {
  education: string
  age: number
  location: string
  skills: string[]
  interests: string[]
  experience?: string
  portfolioUrl?: string
}

export interface StudentMatchResult {
  education: MatchResult
  age: MatchResult
  location: MatchResult
  skills: MatchResult
  experience: MatchResult
  overall: MatchStrength
}

export interface MonitoringItem {
  id: string
  investigationId: string
  active: boolean
  lastCheckedAt: string
  createdAt: string
}

export interface ChangeEvent {
  id: string
  monitoringItemId: string
  field: string
  beforeValue: string
  afterValue: string
  sourceId?: string
  importance: 'low' | 'medium' | 'high'
  detectedAt: string
}

export interface ActionItem {
  order: number
  text: string
  type: 'primary' | 'secondary' | 'warning'
}
