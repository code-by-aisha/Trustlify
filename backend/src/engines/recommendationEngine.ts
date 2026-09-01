/**
 * Trustlify Backend — Recommendation Engine
 *
 * Deterministic "which source should the student actually open?" selection
 * (student-intelligence update, spec 10/11). It runs over data the investigation
 * already persisted — no Gemini, no Tavily, no re-ranking by a model.
 *
 * Preference order (spec 10):
 *   1. an authoritative official source (government / academic classification)
 *   2. the primary organization source (the submitted page's own domain, or an
 *      'official'/'institution' classified source)
 *   3. the strongest independent corroborating source — the one whose fetched
 *      content actually supports claims with verified excerpts
 *
 * Honesty rules:
 *   - Publisher/ownership is NEVER invented. A source is only called
 *     authoritative when the existing deterministic hostname classification
 *     says so; 'unknown' stays 'unknown'.
 *   - When nothing clears the reliability floor, the answer is null and the UI
 *     says so — Trustlify never names a random source "recommended".
 */

export interface RecommendableSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: string;
  publishedAt?: string | null;
  accessStatus?: string | null;
}

export interface RecommendationEvidence {
  sourceId: string;
  relation: string;
  confidence?: string | null;
}

export interface RecommendedSource {
  sourceId: string;
  url: string;
  title: string;
  domain: string;
  /** The persisted classification — the only basis for calling it official. */
  sourceType: string;
  /** Which preference tier produced this pick. */
  tier: "authoritative" | "primary" | "independent";
  /** Why it is recommended, built from the real signals. */
  why: string;
  supportingExcerpts: number;
  contradictingExcerpts: number;
  strongestConfidence: "high" | "medium" | "low" | null;
  /** Verified content was actually fetched from this source. */
  contentAvailable: boolean;
}

export interface RecommendationInput {
  sources: RecommendableSource[];
  evidence: RecommendationEvidence[];
  /** Domain of the page the user submitted, when the input was a URL. */
  submittedDomain?: string | null;
}

const AUTHORITATIVE_TYPES = new Set(["government", "academic"]);
const PRIMARY_TYPES = new Set(["official", "institution"]);

/** Deterministic authority weights from the persisted classification only. */
function authorityWeight(sourceType: string): number {
  if (AUTHORITATIVE_TYPES.has(sourceType)) return 100;
  if (PRIMARY_TYPES.has(sourceType)) return 90;
  if (sourceType === "news" || sourceType === "fact_check") return 45;
  if (sourceType === "independent" || sourceType === "community") return 25;
  if (sourceType === "social") return 10;
  return 20; // 'unknown' and anything unclassified — no credit, no penalty
}

function confidenceOf(
  items: RecommendationEvidence[],
): "high" | "medium" | "low" | null {
  if (items.some((item) => item.confidence === "high")) return "high";
  if (items.some((item) => item.confidence === "medium")) return "medium";
  if (items.some((item) => item.confidence === "low")) return "low";
  return null;
}

/** Below this, the source is too weak to be pointed a student at. */
const RELIABILITY_FLOOR = 30;

/**
 * Pick the one source a student should open, or null when no source in this
 * investigation is reliable enough to recommend.
 */
export function recommendSource(
  input: RecommendationInput,
): RecommendedSource | null {
  const supportsBySource = new Map<string, RecommendationEvidence[]>();
  const contradictsBySource = new Map<string, RecommendationEvidence[]>();

  for (const item of input.evidence) {
    if (item.relation === "supports") {
      const list = supportsBySource.get(item.sourceId) ?? [];
      list.push(item);
      supportsBySource.set(item.sourceId, list);
    } else if (item.relation === "contradicts") {
      const list = contradictsBySource.get(item.sourceId) ?? [];
      list.push(item);
      contradictsBySource.set(item.sourceId, list);
    }
  }

  const submittedDomain = input.submittedDomain
    ? input.submittedDomain.toLowerCase().replace(/^www\./, "")
    : null;

  const scored = input.sources.map((source, index) => {
    const supporting = supportsBySource.get(source.id) ?? [];
    const contradicting = contradictsBySource.get(source.id) ?? [];
    const contentAvailable = source.accessStatus === "available";
    const isSubmittedDomain =
      Boolean(submittedDomain) &&
      normalizeDomain(source.domain) === submittedDomain;

    let score = authorityWeight(source.sourceType);
    score += Math.min(supporting.length, 5) * 6;
    if (supporting.length > 0) score += 20;
    if (confidenceOf(supporting) === "high") score += 12;
    if (contentAvailable) score += 6;
    if (isSubmittedDomain) score += 15;
    if (supporting.length === 0 && contradicting.length > 0) score -= 25;

    const tier: RecommendedSource["tier"] = AUTHORITATIVE_TYPES.has(source.sourceType)
      ? "authoritative"
      : PRIMARY_TYPES.has(source.sourceType) || isSubmittedDomain
        ? "primary"
        : "independent";

    return {
      source,
      index,
      score,
      tier,
      supporting,
      contradicting,
      contentAvailable,
      isSubmittedDomain,
    };
  });

  const sorted = [...scored].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    // Prefer the strongest tier when scores tie, then original source order.
    const tierRank = { authoritative: 0, primary: 1, independent: 2 };
    if (tierRank[a.tier] !== tierRank[b.tier]) {
      return tierRank[a.tier] - tierRank[b.tier];
    }
    return a.index - b.index;
  });

  const best = sorted[0];
  if (!best || best.score < RELIABILITY_FLOOR) return null;

  return {
    sourceId: best.source.id,
    url: best.source.url,
    title: best.source.title,
    domain: best.source.domain,
    sourceType: best.source.sourceType,
    tier: best.tier,
    supportingExcerpts: best.supporting.length,
    contradictingExcerpts: best.contradicting.length,
    strongestConfidence: confidenceOf(best.supporting),
    contentAvailable: best.contentAvailable,
    why: whyText(best),
  };
}

function normalizeDomain(domain: string): string {
  return (domain ?? "").toLowerCase().replace(/^www\./, "");
}

/**
 * The "WHY" line shown under the recommendation. Every clause is a fact about
 * this source — its persisted classification, its excerpt counts, its fetched
 * content — and nothing is claimed about ownership beyond the classification.
 */
function whyText(entry: {
  source: RecommendableSource;
  tier: RecommendedSource["tier"];
  supporting: RecommendationEvidence[];
  contradicting: RecommendationEvidence[];
  contentAvailable: boolean;
  isSubmittedDomain: boolean;
}): string {
  const parts: string[] = [];

  if (entry.tier === "authoritative") {
    parts.push(
      `Authoritative source — its domain is classified as ${entry.source.sourceType.toUpperCase()}.`,
    );
  } else if (entry.isSubmittedDomain) {
    parts.push("Primary source — this is the page that was submitted for investigation.");
  } else if (entry.tier === "primary") {
    parts.push(
      `Classified as a ${entry.source.sourceType.toUpperCase()} source for this opportunity.`,
    );
  } else {
    parts.push("Independent source — not the organiser's own page.");
  }

  const excerptCount = entry.supporting.length;
  if (excerptCount > 0) {
    const confidence = confidenceOf(entry.supporting);
    parts.push(
      `${excerptCount} verified excerpt${excerptCount === 1 ? "" : "s"} in support of the claims${
        confidence ? ` (strongest confidence: ${confidence.toUpperCase()})` : ""
      }.`,
    );
  } else {
    parts.push("No verified supporting excerpt was produced from this source.");
  }

  if (entry.contentAvailable) {
    parts.push("Its full page content was fetched and read, not just the search snippet.");
  } else {
    parts.push("Its page content could not be read — only its search metadata exists.");
  }

  if (entry.contradicting.length > 0) {
    parts.push(
      `It also contradicts ${entry.contradicting.length} claim${entry.contradicting.length === 1 ? "" : "s"} — read it, do not assume it.`,
    );
  }

  return parts.join(" ");
}

/**
 * Deterministic follow-up actions (spec 11). The Trust Engine's verdict action
 * stays untouched — this only appends student-specific next steps that follow
 * from facts already computed.
 */
export function buildRecommendedActions(args: {
  verdictActions: string[];
  eligibilityResult: string | null;
  recommendedSource: RecommendedSource | null;
}): string[] {
  const actions: string[] = [...args.verdictActions];

  if (args.eligibilityResult === "NOT_ELIGIBLE") {
    actions.push("Check other opportunities matching your profile.");
  } else if (args.eligibilityResult === "INSUFFICIENT_DATA") {
    actions.push(
      "Complete the missing fields in your student profile to get an eligibility comparison.",
    );
  }

  if (args.recommendedSource) {
    actions.push(
      `Open the ${args.recommendedSource.domain} source and re-check the eligibility and deadline lines before applying.`,
    );
  } else {
    actions.push(
      "No source in this investigation was strong enough to recommend — find the organiser's own page before acting.",
    );
  }

  return [...new Set(actions)];
}
