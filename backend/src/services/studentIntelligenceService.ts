/**
 * Trustlify Backend — Student Intelligence Derivation
 *
 * Turns the data an investigation ALREADY persisted into the four student
 * capabilities of this update:
 *
 *   1. the user's question + its deterministic intent (questionIntent)
 *   2. currentness / deadline read out of the existing claims (currentnessEngine)
 *   3. a student eligibility comparison against the persisted profile
 *      (studentMatcher)
 *   4. one recommended source + deterministic next actions (recommendationEngine)
 *
 * ⚠ COST CONTRACT — this module makes NO network call and NO model call. It is
 * pure derivation over rows the caller already fetched, so it is safe to run on
 * read: same inputs always produce the same outputs, and refreshes cost nothing.
 *
 * ⚠ It never mutates a verdict or a trust score. The Trust Engine's decision is
 * consumed as-is; everything here is additional, clearly-labelled interpretation.
 */

import {
  classifyQuestionIntent,
  type InvestigationIntent,
} from "../investigation/questionIntent.js";
import {
  assessDeadline,
  assessInvestigationCurrentness,
  assessOpportunityCurrency,
  type DeadlineAssessment,
  type InvestigationCurrentness,
  type OpportunityCurrency,
} from "../engines/currentnessEngine.js";
import {
  calculateStudentMatch,
  type RequirementClaim,
  type StudentMatchResult,
  type StudentProfileFacts,
} from "../engines/studentMatcher.js";
import {
  buildRecommendedActions,
  recommendSource,
  type RecommendedSource,
} from "../engines/recommendationEngine.js";
import { buildDiscoveryQueries, MAX_SEARCHES } from "./similarOpportunityService.js";
import type { PublicProfileEvidence } from "./profileEvidenceService.js";

export interface IntelligenceClaim {
  id: string;
  text: string;
  type: string;
  /** 'supported' | 'contradicted' | 'conflicting' | 'insufficient' | 'pending'. */
  status?: string | null;
  /** 'critical' | 'important' | 'supporting' — used to pick what to summarise. */
  importance?: string | null;
}

export interface IntelligenceSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: string;
  publishedAt: string | null;
  retrievedAt: string | null;
  accessStatus: string | null;
}

export interface IntelligenceEvidence {
  sourceId: string;
  relation: string;
  confidence: string | null;
}

export interface IntelligenceDecision {
  verdict: string;
  trustScore: number;
  recommendedAction: string[];
  reasons: string[];
}

export interface DeriveStudentIntelligenceInput {
  /** The optional question, or null when the user supplied none. */
  investigationQuestion: string | null;
  claims: IntelligenceClaim[];
  sources: IntelligenceSource[];
  evidence: IntelligenceEvidence[];
  decision: IntelligenceDecision | null;
  /** Domain of the page the user submitted, when the input was a URL. */
  submittedDomain?: string | null;
  /** Persisted profile, or null for general users / missing profile. */
  profile: StudentProfileFacts | null;
  /**
   * Facts already read from the student's own PUBLIC portfolio page, when they
   * gave one. Supplied by the caller so this module stays pure (update spec
   * 04/05) — it is supplementary evidence and never replaces `profile`.
   */
  publicProfile?: PublicProfileEvidence | null;
  /** Injectable clock so tests stay deterministic. */
  now?: Date;
}

/* ─── Question-aware presentation order (update spec 08) ──────────────────── */

/**
 * The interpretation blocks of the result page. The raw-evidence appendix
 * (claims, evidence, sources) always stays below them — a question changes
 * which answer comes first, never what the investigation found.
 */
export type IntelligenceSectionKey =
  | "currentness"
  | "match"
  | "recommendedSource"
  | "verdictReasons"
  | "actions";

/** The order this page used before questions existed — the safe default. */
export const DEFAULT_SECTION_ORDER: IntelligenceSectionKey[] = [
  "currentness",
  "match",
  "recommendedSource",
  "verdictReasons",
  "actions",
];

/**
 * Primary intent → what the student asked about first. Deterministic: the same
 * question always produces the same order, and no block is ever dropped.
 */
const SECTION_PRIORITY: Record<InvestigationIntent, IntelligenceSectionKey[]> = {
  ELIGIBILITY: ["match", "currentness", "recommendedSource", "verdictReasons", "actions"],
  DEADLINE: ["currentness", "recommendedSource", "verdictReasons", "actions", "match"],
  CURRENTNESS: ["currentness", "recommendedSource", "verdictReasons", "actions", "match"],
  LEGITIMACY: ["verdictReasons", "recommendedSource", "currentness", "actions", "match"],
  EXPLANATION: ["verdictReasons", "recommendedSource", "currentness", "match", "actions"],
  SIMILAR_OPPORTUNITIES: ["match", "recommendedSource", "currentness", "verdictReasons", "actions"],
  GENERAL: DEFAULT_SECTION_ORDER,
};

export function sectionOrderFor(
  intent: InvestigationIntent | null,
): IntelligenceSectionKey[] {
  const preferred = intent ? SECTION_PRIORITY[intent] : null;
  if (!preferred) return DEFAULT_SECTION_ORDER;
  // Completeness guard: every block still appears, in the requested order.
  return [
    ...new Set(preferred),
    ...DEFAULT_SECTION_ORDER.filter((key) => !preferred.includes(key)),
  ];
}

export interface StudentIntelligence {
  question: string | null;
  /** Null when no question was given — nothing is invented to classify. */
  intent: InvestigationIntent | null;
  /** Answer lines built ONLY from the real outputs of this investigation. */
  answer: string[];
  /** Presentation order of the interpretation blocks, driven by `intent`. */
  emphasis: IntelligenceSectionKey[];
  currentness: {
    opportunity: OpportunityCurrency;
    deadline: DeadlineAssessment;
    sources: InvestigationCurrentness;
  };
  /** Null for non-students — the comparison needs a real student profile. */
  studentMatch: StudentMatchResult | null;
  recommendedSource: RecommendedSource | null;
  recommendedActions: string[];
  /** Echoed so the page can state what portfolio evidence was used. */
  publicProfile: PublicProfileEvidence | null;
}

function isStudent(profile: StudentProfileFacts | null): boolean {
  return String(profile?.role ?? "").toLowerCase() === "student";
}

function quote(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * More than one distinct deadline in the content is a conflict, not a detail to
 * average away — it is stated as a conflict whenever it exists (spec 08).
 */
function dateConflictLine(deadline: DeadlineAssessment): string | null {
  const iso = [...new Set(deadline.dates.map((entry) => entry.iso))];
  if (iso.length < 2) return null;
  return `The content states ${iso.length} different dates (${iso.join(", ")}) — Trustlify reports the conflict instead of picking one, so confirm the closing date on the source itself.`;
}

/**
 * Answer the user's question from computed facts only. Each branch quotes the
 * real assessment produced above — no model wording, no generic filler, and no
 * claim that goes beyond what the data supports.
 */
function buildAnswer(args: {
  intent: InvestigationIntent;
  question: string;
  match: StudentMatchResult | null;
  opportunity: OpportunityCurrency;
  deadline: DeadlineAssessment;
  decision: IntelligenceDecision | null;
  recommendedSource: RecommendedSource | null;
  claims: IntelligenceClaim[];
  discoveryQueries: string[];
}): string[] {
  const {
    intent,
    match,
    opportunity,
    deadline,
    decision,
    recommendedSource,
    claims,
    discoveryQueries,
  } = args;
  const lines: string[] = [];

  switch (intent) {
    case "ELIGIBILITY": {
      if (!match) {
        lines.push(
          "Trustlify could not compare this against a student profile, so it will not guess whether you are eligible.",
          "The stated requirements found in the content are listed under STUDENT MATCH below — check each one against the source itself.",
        );
        break;
      }
      lines.push(match.explanation);
      if (match.missing.length > 0) {
        lines.push(
          `The blockers are: ${match.missing.map((check) => check.detail).join(" ")}`,
        );
      }
      if (match.unknown.length > 0) {
        lines.push(
          `Still unconfirmed: ${match.unknown.map((check) => check.kind).join(", ")} — verify these on the recommended source.`,
        );
      }
      break;
    }

    case "DEADLINE": {
      lines.push(deadline.detail);
      const conflict = dateConflictLine(deadline);
      if (conflict) lines.push(conflict);
      if (deadline.state === "ACTIVE" && match) {
        lines.push(
          `Deadline is open, but your eligibility is ${match.result.replace(/_/g, " ").toLowerCase()} — check the STUDENT MATCH section before applying.`,
        );
      }
      break;
    }

    case "CURRENTNESS": {
      lines.push(opportunity.detail);
      const conflict = dateConflictLine(deadline);
      if (conflict) lines.push(conflict);
      break;
    }

    case "LEGITIMACY": {
      if (decision) {
        lines.push(
          `Trustlify's deterministic verdict is ${decision.verdict} at a trust score of ${decision.trustScore}/100, based on the evidence collected below.`,
        );
        if (decision.reasons[0]) lines.push(decision.reasons[0]);
      } else {
        lines.push(
          "No verdict was recorded for this investigation, so Trustlify cannot say whether it is legitimate.",
        );
      }
      break;
    }

    case "EXPLANATION": {
      // Concise summary of what was actually confirmed, then the caveats —
      // both read straight out of the persisted claim statuses.
      const supported = claims.filter((claim) => claim.status === "supported");
      const important = supported.filter((claim) => claim.importance !== "supporting");
      const facts = (important.length > 0 ? important : supported).slice(0, 3);

      if (facts.length > 0) {
        lines.push(
          `What the collected evidence confirms: ${facts
            .map((claim) => `“${quote(claim.text, 150)}”`)
            .join(" ")}`,
        );
      } else {
        lines.push(
          "Nothing in this content was confirmed by the collected evidence, so there is no verified fact to summarise — that absence is itself the answer.",
        );
      }

      const shaky = claims.filter((claim) => claim.status !== "supported");
      const conflicting = claims.filter(
        (claim) => claim.status === "contradicted" || claim.status === "conflicting",
      );
      if (shaky.length > 0) {
        lines.push(
          `Caveat: ${shaky.length} of ${claims.length} claims stayed unconfirmed${
            conflicting.length > 0 ? `, and ${conflicting.length} of them conflict with other evidence` : ""
          } — the VERIFIED EVIDENCE section below shows the exact excerpt behind each one.`,
        );
      }
      if (decision) {
        lines.push(
          `The verdict computed from that evidence is ${decision.verdict} (trust score ${decision.trustScore}/100) — calculated by code, not by the AI.`,
        );
      }
      break;
    }

    case "SIMILAR_OPPORTUNITIES": {
      // Discovery costs a search and is never run while reading a result, so the
      // answer says what WILL happen and on which deterministic terms.
      lines.push(
        `Trustlify will not invent alternatives. Use FIND SIMILAR OPPORTUNITIES below and it will run at most ${MAX_SEARCHES} searches through the same search provider this investigation already uses.`,
      );
      if (discoveryQueries.length > 0) {
        lines.push(
          `The queries are built by code from your own profile and this content, not by a model: ${discoveryQueries
            .map((query) => `“${query}”`)
            .join(" · ")}`,
        );
      }
      lines.push(
        match
          ? `Each candidate is compared with the same deterministic matcher that produced your result here (${match.result.replace(/_/g, " ").toLowerCase()}) — a match shown below is only stated when its own text supports it.`
          : "Each candidate is compared with the same deterministic matcher, which needs a saved student profile — without one, alternatives are listed but never claimed to fit you.",
      );
      break;
    }

    case "GENERAL": {
      if (decision) {
        lines.push(
          `Verdict: ${decision.verdict} (trust score ${decision.trustScore}/100).`,
        );
      }
      lines.push(opportunity.detail);
      break;
    }
  }

  if (recommendedSource) {
    lines.push(
      `The strongest source to confirm this with is ${recommendedSource.domain} — ${recommendedSource.why}`,
    );
  } else {
    lines.push(
      "No collected source was strong enough for Trustlify to recommend as the one to open.",
    );
  }

  return lines;
}

/**
 * Derive the whole student-intelligence payload. Pure — no I/O.
 */
export function deriveStudentIntelligence(
  input: DeriveStudentIntelligenceInput,
): StudentIntelligence {
  const now = input.now ?? new Date();

  const claims: RequirementClaim[] = input.claims.map((claim) => ({
    id: claim.id,
    text: claim.text,
    type: claim.type,
  }));

  const question = (input.investigationQuestion ?? "").trim() || null;
  const intent = question ? classifyQuestionIntent(question) : null;

  /* ── Currentness + deadline (existing claims only, never invented dates) ── */
  const deadline = assessDeadline(claims, now);
  const sourceCurrentness = assessInvestigationCurrentness(
    input.sources.map((source) => ({
      sourceId: source.id,
      publishedAt: source.publishedAt,
      // Retrieval date is the recorded fact; created_at is the fallback.
      retrievedAt: source.retrievedAt ?? source.publishedAt ?? now.toISOString(),
    })),
  );
  const opportunity = assessOpportunityCurrency(
    deadline,
    sourceCurrentness.overall,
  );

  /* ── Student match (persisted profile vs. extracted requirements) ───────── */
  const match = isStudent(input.profile)
    ? calculateStudentMatch({
        profile: input.profile as StudentProfileFacts,
        claims,
        deadline,
      })
    : null;

  /* ── Recommended source + deterministic next actions ───────────────────── */
  const recommended = recommendSource({
    sources: input.sources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      domain: source.domain,
      sourceType: source.sourceType,
      publishedAt: source.publishedAt,
      accessStatus: source.accessStatus,
    })),
    evidence: input.evidence,
    submittedDomain: input.submittedDomain ?? null,
  });

  const recommendedActions = buildRecommendedActions({
    verdictActions: input.decision?.recommendedAction ?? [],
    eligibilityResult: match?.result ?? null,
    recommendedSource: recommended,
  });

  /* ── Similar-opportunity query preview (no search runs here) ───────────── */
  const discoveryQueries =
    intent === "SIMILAR_OPPORTUNITIES" && isStudent(input.profile)
      ? buildDiscoveryQueries({
          profile: input.profile as StudentProfileFacts,
          claims,
          submittedUrl: null,
          submittedDomain: input.submittedDomain ?? null,
          now,
        }).queries
      : [];

  return {
    question,
    intent,
    emphasis: sectionOrderFor(intent),
    publicProfile: input.publicProfile ?? null,
    answer:
      question && intent
        ? buildAnswer({
            intent,
            question,
            match,
            opportunity,
            deadline,
            decision: input.decision,
            recommendedSource: recommended,
            claims: input.claims,
            discoveryQueries,
          })
        : [],
    currentness: { opportunity, deadline, sources: sourceCurrentness },
    studentMatch: match,
    recommendedSource: recommended,
    recommendedActions,
  };
}
