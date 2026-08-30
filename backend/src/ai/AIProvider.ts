/**
 * Trustlify Backend — AI Provider Interface
 *
 * Defines the contract for all AI operations.
 * The application depends on this interface, not on any specific SDK.
 *
 * Implementation: GeminiProvider (Phase 3A — extractClaims live; rest Phase 3B+)
 * Legacy plan: ModelStudioProvider (placeholder)
 * Future optional: FallbackProvider
 */

import type { Claim, EvidenceItem, Source, StudentMatch, StudentProfile } from "../types/investigation.js";

export interface AIProvider {
  /** Extract discrete claims from raw input (text, OCR output, URL content) */
  extractClaims(input: ExtractClaimsInput): Promise<ExtractClaimsOutput>;

  /** Generate search intents for critical claims */
  planSearch(input: PlanSearchInput): Promise<PlanSearchOutput>;

  /** Analyze retrieved evidence against claims */
  analyzeEvidence(input: AnalyzeEvidenceInput): Promise<AnalyzeEvidenceOutput>;

  /** Verify whether cited evidence supports the investigator's conclusions */
  verifyClaims(input: VerifyClaimsInput): Promise<VerifyClaimsOutput>;

  /** Analyze an image/screenshot to extract text and visual claims */
  analyzeImage(input: AnalyzeImageInput): Promise<AnalyzeImageOutput>;

  /** Match a student profile against opportunity requirements */
  matchStudent(input: MatchStudentInput): Promise<StudentMatch>;

  /** Generate a human-readable explanation of the decision */
  explainDecision(input: ExplainDecisionInput): Promise<string>;

  /** Localize a message to a target language */
  localize(input: LocalizeInput): Promise<string>;
}

// --- Input/Output types ---

export interface ExtractClaimsInput {
  text: string;
  inputType: string;
  language?: string;
}

export interface ExtractClaimsOutput {
  claims: Pick<Claim, "text" | "type" | "importance">[];
}

export interface PlanSearchInput {
  claims: Pick<Claim, "text" | "type" | "importance">[];
  context?: string;
}

export interface PlanSearchOutput {
  queries: SearchQuery[];
}

export interface SearchQuery {
  query: string;
  intent: string;
  priority: "high" | "medium" | "low";
}

export interface AnalyzeEvidenceInput {
  claims: Pick<Claim, "id" | "text" | "type">[];
  sources: Pick<Source, "id" | "url" | "domain" | "sourceType" | "title">[];
  passages: { sourceId: string; text: string }[];
}

export interface AnalyzeEvidenceOutput {
  evidence: Pick<EvidenceItem, "claimId" | "sourceId" | "excerpt" | "relation">[];
}

export interface VerifyClaimsInput {
  claims: Pick<Claim, "id" | "text">[];
  evidence: Pick<EvidenceItem, "claimId" | "sourceId" | "excerpt" | "relation">[];
  investigatorConclusion: string;
}

export interface VerifyClaimsOutput {
  verdict: "APPROVED" | "REJECTED" | "UNCERTAIN";
  reasoning: string;
}

export interface AnalyzeImageInput {
  imageBase64: string;
  mimeType: string;
}

export interface AnalyzeImageOutput {
  extractedText: string;
  visualClaims: string[];
  confidence: "high" | "medium" | "low";
}

export interface MatchStudentInput {
  profile: StudentProfile;
  requirements: string;
}

export interface ExplainDecisionInput {
  verdict: string;
  trustScore: number;
  evidenceSummary: string;
  language?: string;
}

export interface LocalizeInput {
  text: string;
  targetLanguage: string;
}
