/**
 * Trustlify Backend — Investigator
 *
 * Phase 4: runs the ONE Gemini evidence-analysis call of an investigation
 * (spec 20) and validates its output deterministically.
 *
 * ⚠ The model's evidence output is NEVER trusted blindly (spec 21):
 *   - claimId/sourceId must reference the claims and sources actually supplied
 *   - duplicate (claim, source) pairs collapse to the first occurrence
 *   - excerpts MUST be verifiable inside the supplied source content —
 *     fabricated quotations are rejected, and supports/contradicts without a
 *     verifiable excerpt are downgraded to 'insufficient'
 *
 * Claim statuses (spec 23) are then derived by deterministic code:
 *   SUPPORTED / CONFLICTING / CONTRADICTED / UNSUPPORTED / INSUFFICIENT
 */

import type {
  AIProvider,
  AnalyzedEvidenceItem,
} from "../ai/AIProvider.js";
import type { ClassifiedSourceType } from "./sourceNormalizer.js";

/* ─── Models ──────────────────────────────────────────────────────────────── */

export interface InvestigatorClaim {
  id: string;
  text: string;
  type: string;
  importance: string;
}

export interface InvestigatorSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: ClassifiedSourceType;
  /** Extracted page content — the passage supplied to the model. */
  content: string;
}

export type VerifiedEvidenceRelation =
  | "supports"
  | "contradicts"
  | "neutral"
  | "insufficient";

export interface VerifiedEvidence {
  claimId: string;
  sourceId: string;
  relation: VerifiedEvidenceRelation;
  excerpt: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  /** 'approved' when the excerpt was verified against the source content. */
  verificationStatus: "approved" | "uncertain";
}

export type DerivedClaimStatus =
  | "supported"
  | "conflicting"
  | "contradicted"
  | "unsupported"
  | "insufficient";

export interface ClaimStatus {
  claimId: string;
  status: DerivedClaimStatus;
  reasoningSummary: string;
}

export const EXCERPT_UNVERIFIED_REASON =
  "Excerpt could not be verified against the source content.";

/* ─── Excerpt verification (pure) ─────────────────────────────────────────── */

/** Collapse every whitespace run to a single space (line breaks included). */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * True when the excerpt appears verbatim (whitespace-insensitive) inside the
 * supplied source content.
 */
export function excerptExistsInContent(excerpt: string, content: string): boolean {
  const needle = normalizeWhitespace(excerpt);
  if (needle.length === 0) return false;
  return normalizeWhitespace(content).includes(needle);
}

/* ─── Validation of model output (pure, spec 21) ─────────────────────────── */

export interface ValidatedAnalysis {
  evidence: VerifiedEvidence[];
  /** Items dropped entirely (unknown ids, duplicate pairs, fabricated excerpts). */
  rejectedCount: number;
}

export function validateEvidenceAnalysis(args: {
  candidates: AnalyzedEvidenceItem[];
  claims: { id: string }[];
  sources: InvestigatorSource[];
}): ValidatedAnalysis {
  const claimIds = new Set(args.claims.map((claim) => claim.id));
  const sourceById = new Map(args.sources.map((source) => [source.id, source]));
  const seenPairs = new Set<string>();

  const evidence: VerifiedEvidence[] = [];
  let rejectedCount = 0;

  for (const candidate of args.candidates) {
    if (!claimIds.has(candidate.claimId) || !sourceById.has(candidate.sourceId)) {
      rejectedCount += 1; // references a claim/source we never supplied
      continue;
    }

    const pairKey = `${candidate.claimId}:${candidate.sourceId}`;
    if (seenPairs.has(pairKey)) {
      rejectedCount += 1; // duplicate pair — first occurrence wins
      continue;
    }

    const source = sourceById.get(candidate.sourceId)!;
    const excerptVerified =
      candidate.excerpt.length > 0 &&
      excerptExistsInContent(candidate.excerpt, source.content);

    let relation: VerifiedEvidenceRelation = candidate.relation;
    let excerpt = candidate.excerpt;
    let reason = candidate.reason;
    let confidence = candidate.confidence;
    let verificationStatus: VerifiedEvidence["verificationStatus"] = "approved";

    if (
      (relation === "supports" || relation === "contradicts") &&
      !excerptVerified
    ) {
      // A claim of support/contradiction without a verifiable quotation is
      // not evidence — downgrade honestly to insufficient (never trust it).
      relation = "insufficient";
      excerpt = "";
      reason = EXCERPT_UNVERIFIED_REASON;
      confidence = "low";
      verificationStatus = "uncertain";
    } else if (
      (relation === "neutral" || relation === "insufficient") &&
      candidate.excerpt.length > 0 &&
      !excerptVerified
    ) {
      // A neutral/insufficient item with a fabricated quotation is worthless
      // and misleading — reject it entirely.
      rejectedCount += 1;
      continue;
    } else if (relation === "insufficient" && candidate.excerpt.length === 0) {
      verificationStatus = "approved";
    }

    seenPairs.add(pairKey);
    evidence.push({
      claimId: candidate.claimId,
      sourceId: candidate.sourceId,
      relation,
      excerpt,
      reason,
      confidence,
      verificationStatus,
    });
  }

  return { evidence, rejectedCount };
}

/* ─── Credibility model (deterministic, spec 17/21/23) ───────────────────── */

function isAuthoritative(sourceType: ClassifiedSourceType): boolean {
  return sourceType === "government" || sourceType === "academic";
}

/**
 * An item is credible on its own when its source is authoritative
 * (deterministic hostname classification) or when an ordinary source asserts
 * the relationship with high confidence. Social media is never primary
 * evidence on its own.
 */
function isCredible(item: VerifiedEvidence, sourceType: ClassifiedSourceType): boolean {
  if (isAuthoritative(sourceType)) return true;
  if (sourceType === "social") return false;
  return item.confidence === "high";
}

interface RelationTally {
  credible: VerifiedEvidence[];
  /** Independent (distinct-domain) medium-or-better confirmations. */
  independentConfident: VerifiedEvidence[];
}

function tally(
  evidence: VerifiedEvidence[],
  sources: InvestigatorSource[],
  relation: VerifiedEvidenceRelation,
): RelationTally {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const items = evidence.filter((item) => item.relation === relation);

  const credible = items.filter((item) => {
    const source = sourceById.get(item.sourceId);
    return source ? isCredible(item, source.sourceType) : false;
  });

  const byDomain = new Map<string, VerifiedEvidence>();
  for (const item of items) {
    const source = sourceById.get(item.sourceId);
    if (!source) continue;
    if (source.sourceType === "social") continue;
    if (item.confidence === "low") continue;
    // keep the highest-confidence item per domain
    const existing = byDomain.get(source.domain);
    if (!existing) {
      byDomain.set(source.domain, item);
    }
  }
  const independentConfident = [...byDomain.values()];

  return { credible, independentConfident };
}

/** A relation is established when credible directly or independently (≥2 domains). */
function isEstablished(t: RelationTally): boolean {
  return t.credible.length > 0 || t.independentConfident.length >= 2;
}

/* ─── Claim status derivation (pure, spec 23) ─────────────────────────────── */

export function deriveClaimStatuses(args: {
  claims: InvestigatorClaim[];
  evidence: VerifiedEvidence[];
  sources: InvestigatorSource[];
}): ClaimStatus[] {
  const sourceById = new Map(args.sources.map((source) => [source.id, source]));

  return args.claims.map((claim) => {
    const items = args.evidence.filter((item) => item.claimId === claim.id);
    const supports = tally(items, args.sources, "supports");
    const contradicts = tally(items, args.sources, "contradicts");
    const supportEstablished = isEstablished(supports);
    const contradictEstablished = isEstablished(contradicts);

    const supportDomains = [
      ...new Set(supports.credible.map((i) => sourceById.get(i.sourceId)?.domain ?? "")),
    ].filter(Boolean);
    const contradictDomains = [
      ...new Set(contradicts.credible.map((i) => sourceById.get(i.sourceId)?.domain ?? "")),
    ].filter(Boolean);

    if (supportEstablished && contradictEstablished) {
      return {
        claimId: claim.id,
        status: "conflicting",
        reasoningSummary: `Evidence conflicts: supported by ${supportDomains.join(", ") || "search sources"} but contradicted by ${contradictDomains.join(", ") || "search sources"}.`,
      };
    }
    if (supportEstablished) {
      return {
        claimId: claim.id,
        status: "supported",
        reasoningSummary:
          supportDomains.length > 0
            ? `Supported by ${supportDomains.join(", ")}.`
            : "Supported by independent sources.",
      };
    }
    if (contradictEstablished) {
      return {
        claimId: claim.id,
        status: "contradicted",
        reasoningSummary: `Contradicted by ${contradictDomains.join(", ") || "search sources"}.`,
      };
    }
    if (items.length > 0) {
      return {
        claimId: claim.id,
        status: "unsupported",
        reasoningSummary:
          "Evidence was checked, but no credible support for this claim was found.",
      };
    }
    return {
      claimId: claim.id,
      status: "insufficient",
      reasoningSummary: "No reliable evidence was found for this claim.",
    };
  });
}

/* ─── One-call orchestration (spec 20/40) ────────────────────────────────── */

export interface EvidenceAnalysisResult {
  evidence: VerifiedEvidence[];
  claimStatuses: ClaimStatus[];
  rejectedCount: number;
}

/**
 * Run the single Gemini evidence-analysis call and validate its output.
 * Throws AIError when the provider call fails — the caller decides how to
 * continue honestly (spec 33); nothing is invented here.
 */
export async function analyzeEvidenceAndValidate(args: {
  ai: Pick<AIProvider, "analyzeEvidence">;
  claims: InvestigatorClaim[];
  sources: InvestigatorSource[];
}): Promise<EvidenceAnalysisResult> {
  const output = await args.ai.analyzeEvidence({
    claims: args.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      type: claim.type as never,
    })),
    sources: args.sources.map((source) => ({
      id: source.id,
      url: source.url,
      domain: source.domain,
      sourceType: source.sourceType,
      title: source.title,
    })),
    passages: args.sources.map((source) => ({
      sourceId: source.id,
      text: source.content,
    })),
  });

  const { evidence, rejectedCount } = validateEvidenceAnalysis({
    candidates: output.evidence,
    claims: args.claims,
    sources: args.sources,
  });

  const claimStatuses = deriveClaimStatuses({
    claims: args.claims,
    evidence,
    sources: args.sources,
  });

  return { evidence, claimStatuses, rejectedCount };
}
