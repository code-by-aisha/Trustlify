/**
 * Trustlify Backend — Claim Selector + Search Query Builder
 *
 * Deterministic, AI-free ranking of claims (spec 13) and safe query
 * generation. The LLM NEVER selects claims and NEVER generates search
 * queries — both are ordinary deterministic code.
 *
 * Claim priority order (spec 13):
 *   1. legitimacy/identity      (organization)
 *   2. critical funding claims  (funding + critical importance)
 *   3. deadline
 *   4. eligibility
 *   5. application/payment requirements (application_url, fee)
 *   6. other factual claims     (everything else)
 *
 * Tie-breaking is fully deterministic: importance, then longer (more
 * specific) text, then lexicographic order — the same input always ranks
 * identically.
 *
 * Query text is treated as untrusted data: injection phrasing is stripped,
 * whitespace/punctuation normalized, length capped (spec 14).
 */

import type { ClaimImportance, ClaimType } from "../types/investigation.js";

/* ─── Claim shape used by the selector ────────────────────────────────────── */

export interface SelectableClaim {
  id?: string;
  text: string;
  type: ClaimType;
  importance: ClaimImportance;
}

/* ─── Deterministic ordering tables ───────────────────────────────────────── */

const IMPORTANCE_RANK: Record<ClaimImportance, number> = {
  critical: 0,
  important: 1,
  supporting: 2,
};

/**
 * Spec 13 claim-priority tiers. Lower tier = higher priority.
 * Funding only occupies tier 1 when critical — a casually-mentioned cost is
 * an ordinary factual claim (tier 5).
 */
export function claimPriorityTier(claim: SelectableClaim): number {
  switch (claim.type) {
    case "organization":
      return 0; // legitimacy/identity
    case "funding":
      return claim.importance === "critical" ? 1 : 5; // critical funding claims
    case "deadline":
      return 2;
    case "eligibility":
      return 3;
    case "application_url":
    case "fee":
      return 4; // application/payment requirements
    default:
      return 5; // other factual claims
  }
}

/**
 * Rank all claims deterministically by spec-13 priority.
 * Ordering: tier → importance → longer (more specific) text → lexicographic.
 */
export function rankClaims<T extends SelectableClaim>(claims: T[]): T[] {
  return [...claims].sort((a, b) => {
    const byTier = claimPriorityTier(a) - claimPriorityTier(b);
    if (byTier !== 0) return byTier;

    const byImportance = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    if (byImportance !== 0) return byImportance;

    // More specific (longer) claims win; then lexicographic for full stability.
    const byLength = b.text.length - a.text.length;
    if (byLength !== 0) return byLength;

    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });
}

/**
 * Select the single highest-priority claim, deterministically.
 */
export function selectPriorityClaim<T extends SelectableClaim>(
  claims: T[],
): T | null {
  const ranked = rankClaims(claims);
  return ranked.length > 0 ? ranked[0] : null;
}

/**
 * The first claim of a given type in ranked (priority) order.
 */
export function firstClaimOfType<T extends SelectableClaim>(
  claims: T[],
  type: ClaimType,
): T | null {
  return rankClaims(claims).find((claim) => claim.type === type) ?? null;
}

/* ─── Search query sanitization (shared with searchPlanner) ───────────────── */

/** Obvious prompt-injection phrasing stripped from query text. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
  /\b(system|developer)\s*(prompt|message|instruction)s?\s*:/gi,
  /\bdisregard\s+(all\s+)?(previous|prior|above)/gi,
  /\byou\s+are\s+(now|an?)\b/gi,
  /\b(reveal|leak|print|expose)\s+(the\s+)?(api\s+)?(key|token|secret|password)s?\b/gi,
  /\b(api|secret|access)\s+(key|token|password)s?\b/gi,
];

const MAX_QUERY_LENGTH = 160;
/** Suffix biasing the search toward authoritative pages (spec 08/14). */
const AUTHORITATIVE_SUFFIX = "official";

export function stripInjectionPatterns(text: string): string {
  let out = text;
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, " ");
  }
  return out;
}

export function normalizeQueryText(text: string): string {
  return (
    text
      // collapse all whitespace
      .replace(/\s+/g, " ")
      // strip characters with no search value (keep word chars, spaces, basic punctuation)
      .replace(/[^\p{L}\p{N} .,'&/-]+/gu, " ")
      // ellipsis-style dot runs are noise — a single dot may still be meaningful
      .replace(/\.{2,}/g, " ")
      // collapse sequences of punctuation-ish spacing
      .replace(/\s+([.,/-])\s+/g, "$1 ")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** Sanitize claim text into safe, bounded search-query text. */
export function sanitizeQueryFragment(text: string): string {
  return normalizeQueryText(stripInjectionPatterns(text)).replace(/\.+$/, "");
}

/**
 * Build ONE deterministic search query from a claim.
 * The claim text is treated as untrusted data: injection phrasing is removed,
 * whitespace/punctuation normalized, length capped.
 */
export function buildSearchQuery(claim: SelectableClaim): string {
  const cleaned = sanitizeQueryFragment(claim.text);
  const base = cleaned.length > 0 ? cleaned : claim.type.replace(/_/g, " ");
  const withSuffix = `${base} ${AUTHORITATIVE_SUFFIX}`.replace(/\s+/g, " ").trim();
  return withSuffix.length > MAX_QUERY_LENGTH
    ? `${withSuffix.slice(0, MAX_QUERY_LENGTH).trimEnd()}`
    : withSuffix;
}
