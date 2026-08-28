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

/** Evidence relation to a claim */
export type EvidenceRelation = 'supports' | 'contradicts' | 'neutral'

/** Investigation stages */
export type InvestigationStage =
  | 'NORMALIZING'
  | 'CLAIMS'
  | 'SEARCH'
  | 'EVIDENCE'
  | 'INVESTIGATING'
  | 'VERIFYING'
  | 'MATCHING'
  | 'DECIDING'
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

export interface Claim {
  id: string
  text: string
  type: string
  importance: 'critical' | 'moderate' | 'low'
  status?: string
  reasoningSummary?: string
}

export interface Source {
  id: string
  investigationId: string
  url: string
  title: string
  domain: string
  sourceType: SourceType
  publisher?: string
  publishedAt?: string
  updatedAt?: string
  retrievedAt: string
  authorityLevel: SourceTier
  accessStatus: 'ok' | 'blocked' | 'timeout' | 'not_found'
}

export interface Evidence {
  id: string
  claimId: string
  sourceId: string
  excerpt: string
  relation: EvidenceRelation
  exactLocation?: string
  retrievedAt: string
  verificationStatus: 'verified' | 'pending' | 'rejected'
}

export interface Investigation {
  id: string
  userId?: string
  inputType: InputType
  inputText?: string
  inputFileUrl?: string
  status: InvestigationStage
  verdict?: Verdict
  trustScore?: number
  claims: Claim[]
  sources: Source[]
  evidence: Evidence[]
  createdAt: string
  updatedAt: string
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
