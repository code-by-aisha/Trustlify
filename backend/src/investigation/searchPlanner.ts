/**
 * Trustlify Backend — Search Planner
 *
 * Phase 4: deterministic search query planning (spec 14). The LLM NEVER
 * generates search queries — queries are ordinary code built from the actual
 * extracted claims:
 *
 *   1. organization + opportunity + "official"   (identity/legitimacy check)
 *   2. opportunity + eligibility                 (eligibility check)
 *   3. opportunity + deadline                    (deadline check)
 *
 * DEFAULT MAX = 3 search requests per investigation (spec 15); fewer when
 * the claims don't support a query (e.g. no eligibility claim → no
 * eligibility query). Queries are normalized: whitespace, excessive
 * punctuation, prompt-injection wording, and length are all bounded — user
 * or webpage text is never blindly copied into a query.
 */

import { env } from "../config/env.js";
import {
  rankClaims,
  firstClaimOfType,
  sanitizeQueryFragment,
  type SelectableClaim,
} from "./claimSelector.js";

/* ─── Planned query model ─────────────────────────────────────────────────── */

export type SearchIntent =
  | "identity_official"
  | "eligibility"
  | "deadline"
  | "top_claim";

export interface PlannedQuery {
  query: string;
  intent: SearchIntent;
}

const MAX_QUERY_LENGTH = 160;
/** Enough result slots to fill the ≤3 fetch slots after dedupe. */
export const SEARCH_MAX_RESULTS = 5;

function capQuery(query: string): string {
  const normalized = query.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_QUERY_LENGTH
    ? normalized.slice(0, MAX_QUERY_LENGTH).trimEnd()
    : normalized;
}

/** Join non-empty sanitized fragments into one query string. */
function buildQuery(fragments: (string | null | undefined)[]): string {
  return capQuery(
    fragments
      .filter((fragment): fragment is string => Boolean(fragment))
      .map((fragment) => sanitizeQueryFragment(fragment))
      .filter((fragment) => fragment.length > 0)
      .join(" "),
  );
}

/**
 * Plan the targeted search queries for an investigation.
 *
 * Deterministic: the same ranked claims always produce the same queries in
 * the same order. Returns at most `maxQueries` (default from env, hard cap 3).
 */
export function planSearchQueries(
  claims: SelectableClaim[],
  maxQueries: number = env.INVESTIGATION_MAX_SEARCHES,
): PlannedQuery[] {
  if (claims.length === 0) return [];

  const cap = Math.min(Math.max(1, maxQueries), 3);
  const ranked = rankClaims(claims);
  const organization = firstClaimOfType(claims, "organization");
  const opportunity = firstClaimOfType(claims, "opportunity");
  const eligibility = firstClaimOfType(claims, "eligibility");
  const deadline = firstClaimOfType(claims, "deadline");

  // The subject anchor for targeted queries: the opportunity when present,
  // otherwise the organization, otherwise the top-ranked claim.
  const subject = opportunity ?? organization ?? ranked[0];
  const subjectText = subject.text;

  const queries: PlannedQuery[] = [];

  // 1. organization + opportunity + official (the top claim stands in only
  //    when neither an organization nor an opportunity claim exists — never
  //    duplicate the organization text in the same query)
  const identityQuery = buildQuery([
    organization?.text,
    opportunity?.text ?? (organization ? null : subjectText),
    "official",
  ]);
  if (identityQuery.length > 0) {
    queries.push({ query: identityQuery, intent: "identity_official" });
  }

  // 2. opportunity + eligibility
  if (eligibility) {
    const eligibilityQuery = buildQuery([subjectText, eligibility.text]);
    if (eligibilityQuery.length > 0) {
      queries.push({ query: eligibilityQuery, intent: "eligibility" });
    }
  }

  // 3. opportunity + deadline
  if (deadline) {
    const deadlineQuery = buildQuery([subjectText, deadline.text]);
    if (deadlineQuery.length > 0) {
      queries.push({ query: deadlineQuery, intent: "deadline" });
    }
  }

  // Note: the identity query always carries the top claim as its anchor when
  // no organization/opportunity claim exists, so a standalone fallback is
  // unnecessary — every non-empty claim set produces at least one query.

  return queries.slice(0, cap);
}
