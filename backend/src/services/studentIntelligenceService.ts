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

export interface IntelligenceClaim {
  id: string;
  text: string;
  type: string;
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
  /** Injectable clock so tests stay deterministic. */
  now?: Date;
}

export interface StudentIntelligence {
  question: string | null;
  /** Null when no question was given — nothing is invented to classify. */
  intent: InvestigationIntent | null;
  /** Answer lines built ONLY from the real outputs of this investigation. */
  answer: string[];
  currentness: {
    opportunity: OpportunityCurrency;
    deadline: DeadlineAssessment;
    sources: InvestigationCurrentness;
  };
  /** Null for non-students — the comparison needs a real student profile. */
  studentMatch: StudentMatchResult | null;
  recommendedSource: RecommendedSource | null;
  recommendedActions: string[];
}

function isStudent(profile: StudentProfileFacts | null): boolean {
  return String(profile?.role ?? "").toLowerCase() === "student";
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
}): string[] {
  const { intent, match, opportunity, deadline, decision, recommendedSource } = args;
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
      if (deadline.state === "ACTIVE" && match) {
        lines.push(
          `Deadline is open, but your eligibility is ${match.result.replace(/_/g, " ").toLowerCase()} — check the STUDENT MATCH section before applying.`,
        );
      }
      break;
    }

    case "CURRENTNESS": {
      lines.push(opportunity.detail);
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

  return {
    question,
    intent,
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
          })
        : [],
    currentness: { opportunity, deadline, sources: sourceCurrentness },
    studentMatch: match,
    recommendedSource: recommended,
    recommendedActions,
  };
}
