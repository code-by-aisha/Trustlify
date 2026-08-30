/**
 * Trustlify Backend — Claim Selector + Search Query Builder
 *
 * Phase 3C: deterministic, AI-free selection of the single claim that drives
 * the targeted web search, plus deterministic query generation from that claim.
 *
 * Rules (spec 07/08):
 *   - ONE claim, selected deterministically — never by a second AI call
 *   - Priority: 1) critical importance  2) factual/date/eligibility relevance
 *               3) stable tie-breaker
 *   - The query is normalized: whitespace, excessive punctuation, and obvious
 *     prompt-injection text are stripped. Search results are DATA, not
 *     instructions — but we still never forward injection-style text into a
 *     query.
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
 * Factual relevance ranking for search priority. Deadline/eligibility/funding
 * facts are the decisions students act on, so they outrank context.
 */
const TYPE_RANK: Record<ClaimType, number> = {
  deadline: 0,
  eligibility: 1,
  funding: 2,
  current_status: 3,
  fee: 4,
  application_url: 5,
  opportunity: 6,
  organization: 7,
  location: 8,
  contact: 9,
  data_request: 10,
  other: 11,
};

/**
 * Select the single highest-priority claim, deterministically.
 *
 * Ordering: importance rank → type rank → longer text (more specific) →
 * lexicographic text (final stable tie-breaker). Ties resolve identically on
 * every run for the same input.
 */
export function selectPriorityClaim<T extends SelectableClaim>(
  claims: T[],
): T | null {
  if (claims.length === 0) return null;

  const sorted = [...claims].sort((a, b) => {
    const byImportance = IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance];
    if (byImportance !== 0) return byImportance;

    const byType = TYPE_RANK[a.type] - TYPE_RANK[b.type];
    if (byType !== 0) return byType;

    // More specific (longer) claims win; then lexicographic for full stability.
    const byLength = b.text.length - a.text.length;
    if (byLength !== 0) return byLength;

    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });

  return sorted[0];
}

/* ─── Search query generation ─────────────────────────────────────────────── */

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
/** Suffix biasing the search toward authoritative pages (spec 08). */
const AUTHORITATIVE_SUFFIX = "official";

function stripInjectionPatterns(text: string): string {
  let out = text;
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, " ");
  }
  return out;
}

function normalizeQueryText(text: string): string {
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

/**
 * Build ONE deterministic search query from the selected claim.
 * The claim text is treated as untrusted data: injection phrasing is removed,
 * whitespace/punctuation normalized, length capped.
 */
export function buildSearchQuery(claim: SelectableClaim): string {
  const cleaned = normalizeQueryText(stripInjectionPatterns(claim.text))
    // a trailing sentence period would collide with the appended suffix
    .replace(/\.+$/, "");
  const base = cleaned.length > 0 ? cleaned : claim.type.replace(/_/g, " ");
  const withSuffix = `${base} ${AUTHORITATIVE_SUFFIX}`.replace(/\s+/g, " ").trim();
  return withSuffix.length > MAX_QUERY_LENGTH
    ? `${withSuffix.slice(0, MAX_QUERY_LENGTH).trimEnd()}`
    : withSuffix;
}
