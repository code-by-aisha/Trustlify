/**
 * Trustlify Backend — Investigation Types
 *
 * Core domain types for the investigation pipeline.
 * Phase 1: Type definitions only. Real implementation in later phases.
 */

export type InvestigationStatus =
  | "CREATED"
  | "NORMALIZING"
  | "CLAIMS"
  | "SEARCH"
  | "SOURCES"
  | "EVIDENCE"
  | "INVESTIGATING"
  | "VERIFYING"
  | "MATCHING"
  | "DECIDING"
  | "COMPLETE"
  | "FAILED";

export type Verdict = "VERIFIED" | "CAUTION" | "HIGH_RISK" | "UNVERIFIED";

export type InputType = "url" | "text" | "image" | "pdf";

export interface Investigation {
  id: string;
  userId: string;
  inputType: InputType;
  inputText?: string;
  inputFilePath?: string;
  status: InvestigationStatus;
  verdict?: Verdict;
  trustScore?: number;
  claims: Claim[];
  sources: Source[];
  evidence: EvidenceItem[];
  decision?: Decision;
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  investigationId: string;
  text: string;
  type: ClaimType;
  importance: ClaimImportance;
  status: ClaimStatus;
  reasoningSummary?: string;
  createdAt: string;
}

export type ClaimType =
  | "organization"
  | "opportunity"
  | "deadline"
  | "current_status"
  | "funding"
  | "fee"
  | "eligibility"
  | "application_url"
  | "data_request"
  | "location"
  | "contact"
  | "other";

export type ClaimImportance = "critical" | "important" | "supporting";

export type ClaimStatus = "pending" | "supported" | "contradicted" | "conflicting" | "insufficient";

export interface Source {
  id: string;
  investigationId: string;
  url: string;
  title: string;
  domain: string;
  sourceType: SourceType;
  publisher?: string;
  publishedAt?: string;
  updatedAt?: string;
  retrievedAt: string;
  authorityLevel: AuthorityLevel;
  contentHash?: string;
  accessStatus: AccessStatus;
}

export type SourceType =
  | "submitted"
  | "official"
  | "government"
  | "academic"
  | "institution"
  | "news"
  | "independent"
  | "fact_check"
  | "community"
  | "user_submitted"
  // Phase 3C conservative classifications (hostname heuristics only):
  // 'social' for exact-match social platform hosts, 'unknown' whenever the
  // hostname gives no defensible deterministic signal.
  | "social"
  | "unknown";

export type AuthorityLevel = 1 | 2 | 3 | 4;

export type AccessStatus = "available" | "restricted" | "unavailable" | "error";

export interface EvidenceItem {
  id: string;
  claimId: string;
  sourceId: string;
  excerpt: string;
  relation: EvidenceRelation;
  exactLocation?: string;
  retrievedAt: string;
  verificationStatus: VerificationStatus;
}

export type EvidenceRelation = "supports" | "contradicts" | "neutral";

export type VerificationStatus = "pending" | "approved" | "rejected" | "uncertain";

export interface Decision {
  id: string;
  investigationId: string;
  verdict: Verdict;
  trustScore: number;
  explanation: string;
  recommendedAction: string[];
  createdAt: string;
}

export interface MonitoringItem {
  id: string;
  investigationId: string;
  userId: string;
  active: boolean;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface ChangeEvent {
  id: string;
  monitoringItemId: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  sourceId?: string;
  importance: "high" | "medium" | "low";
  detectedAt: string;
}

export interface Upload {
  id: string;
  userId: string;
  path: string;
  contentType: string;
  size: number;
  createdAt: string;
}

/**
 * Student profile for matching.
 */
export interface StudentProfile {
  userId: string;
  education?: string;
  age?: number;
  location?: string;
  skills?: string[];
  interests?: string[];
  experience?: string;
  portfolioUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentMatch {
  education: MatchStatus;
  age: MatchStatus;
  location: MatchStatus;
  skills: MatchStatus;
  experience: MatchStatus;
  overall: MatchOverall;
}

export type MatchStatus = "MATCH" | "MISMATCH" | "UNKNOWN";
export type MatchOverall = "STRONG" | "MODERATE" | "WEAK" | "UNCLEAR";
