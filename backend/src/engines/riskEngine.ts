/**
 * Trustlify Backend — Risk Engine
 *
 * Phase 5 (implemented with the Phase 4 pipeline): deterministic risk signal
 * detection (spec 25). These are SIGNALS, not verdicts — a single signal
 * never equals HIGH_RISK by itself. The Trust Engine weighs them.
 *
 * Signals:
 *   suspicious_redirect   — submitted URL redirected to a different domain
 *   payment_request       — the content asks the reader for payment/fees
 *   weak_source_authority — no INDEPENDENT (government/academic) source
 *   identity_mismatch     — an organization/identity claim is contradicted
 *   unresolved_contradiction — a critical claim conflicts across sources
 *   missing_official_confirmation — the organization claim is not supported
 *                           by any authoritative source (government, academic,
 *                           or the organization's own first-party page)
 */

import type { RiskSignal } from "./trustEngine.js";

export interface RiskEngineInput {
  /** Submitted URL redirected to a different registrable domain. */
  domainChanged: boolean;
  originalDomain: string | null;
  finalDomain: string | null;
  claims: {
    id: string;
    text: string;
    type: string;
    importance: string;
    status: string;
  }[];
  /** Deterministic source classifications of the discovered sources. */
  sourceTypes: string[];
  /**
   * True when at least one claim is supported by an authoritative source.
   * 'Authoritative' uses the Trust Engine's authority model — government,
   * academic, OR first-party to this investigation — because the organization's
   * own page genuinely does confirm its own identity.
   */
  hasAuthoritativeSupport: boolean;
}

/**
 * Deterministic payment/fee request wording in claim text.
 * Matches fee-type claims and payment-demand phrasing in any claim text.
 */
const PAYMENT_PATTERNS: RegExp[] = [
  /\bpay(?:ment|ment\s+fee|\s+now|\s+via)\b/i,
  /\bapplication\s+fee\b/i,
  /\bprocessing\s+fee\b/i,
  /\bregistration\s+fee\b/i,
  /\bwire\s+transfer\b/i,
  /\bmoney\s?gram\b/i,
  /\bwestern\s+union\b/i,
  /\bbeneficiary\s+(?:fee|charges?)\b/i,
  /\b(?:send|pay)\s+(?:the\s+)?(?:fee|amount|money)\s+(?:via|through|to)\b/i,
  /\bnon[- ]?refundable\s+(?:fee|deposit)\b/i,
];

/**
 * Clause boundaries: end of sentence, or a contrastive connective that separates
 * what is charged from what is free ("… is free, but a fee applies"). Splitting
 * on these keeps a negation in one sentence from cancelling a demand in the
 * next, and vice versa.
 */
const CLAUSE_SPLIT_RE =
  /[.;:!?\n]+|[,;]?\s+(?:but|although|though|however|whereas|while)\s+/i;

/**
 * A clause that DENIES a payment rather than demanding one. Deterministic
 * surface negation only — no NLP dependency, no model call, no keyword ban:
 * 'payment', 'fee' and 'charge' still trigger, they just must not be negated.
 * Bare 'non' is deliberately absent: it is a word prefix, and "non-refundable
 * fee" is the strongest possible statement that money IS required.
 */
const PAYMENT_NEGATION_RE =
  /\b(?:no|not|never|none|nor|without|zero|free|waiv(?:e|es|ed|ing)|exempt(?:ed|ion)?|complimentary|nothing|don'?t|doesn'?t|didn'?t|won'?t|cannot|can'?t)\b/i;

/**
 * Refundability talks about getting money BACK, never about it not being
 * charged. Masked before the negation test so "a non-refundable registration
 * fee" keeps firing while "no registration fee" still cancels.
 */
const REFUNDABILITY_RE = /\b(?:non[- ]?refundable|not\s+refundable|refundable)\b/gi;

/** An explicit "it costs nothing" statement (covers 'free of charge'). */
const FREE_STATEMENT_RE =
  /\bfree\b|\bno\s+(?:\S+\s+)?(?:fee|payment|charges?|cost)\b|\bwithout\s+(?:any\s+)?(?:fee|payment|charge|cost)\b|\b(?:fee|payment|charge|cost)\s+(?:is\s+|are\s+)?waived\b|\bzero\s+(?:fee|cost|charge)\b|\bat\s+no\s+cost\b|\b(?:do(?:es)?\s+not|do(?:es)?n'?t|\w+\s+(?:is|are)\s+not)\s+(?:charge|cost|required|necessary|applicable)\b/i;

function clausesOf(text: string): string[] {
  return text
    .split(CLAUSE_SPLIT_RE)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

/** Negation test that ignores refundability phrasing (see REFUNDABILITY_RE). */
function negatesPayment(clause: string): boolean {
  return PAYMENT_NEGATION_RE.test(clause.replace(REFUNDABILITY_RE, " "));
}

/**
 * True when this specific clause demands payment. A payment word is not enough:
 * the clause must also be free of negation ("No registration fee is required"
 * is a clause that mentions a fee to say it does not exist).
 */
function clauseDemandsPayment(clause: string): boolean {
  if (!PAYMENT_PATTERNS.some((pattern) => pattern.test(clause))) return false;
  return !negatesPayment(clause);
}

/** True when the text states anywhere that nothing has to be paid. */
function statesNoPayment(text: string): boolean {
  return clausesOf(text).some(
    (clause) =>
      FREE_STATEMENT_RE.test(clause) ||
      (negatesPayment(clause) && PAYMENT_PATTERNS.some((pattern) => pattern.test(clause))),
  );
}

/**
 * Does this claim actually assert a payment requirement?
 *
 *  · Any unnegated payment-demand clause → yes ("Pay Rs 5,000 to register.").
 *  · A 'fee'-type claim with no such clause is still a fee requirement UNLESS
 *    its own wording says the fee is absent or free — the claim TYPE is about
 *    the topic (a fee claim may assert "registration is free"), so on its own
 *    it is never proof that money is requested.
 *  · Any other claim → only an unnegated demand counts.
 */
function claimAssertsPayment(claim: { text: string; type: string }): boolean {
  if (clausesOf(claim.text).some(clauseDemandsPayment)) return true;
  if (claim.type === "fee") return !statesNoPayment(claim.text);
  return false;
}

/**
 * Detect risk signals deterministically from structured facts.
 * Every signal carries a human-readable detail that the result page can show
 * verbatim — no generic AI filler.
 */
export function detectRiskSignals(input: RiskEngineInput): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const organizationClaims = input.claims.filter(
    (claim) => claim.type === "organization",
  );
  const criticalConflicting = input.claims.filter(
    (claim) =>
      claim.importance === "critical" &&
      (claim.status === "conflicting" || claim.status === "contradicted"),
  );
  const hasAuthoritativeSource = input.sourceTypes.some(
    (type) => type === "government" || type === "academic",
  );
  const paymentClaim = input.claims.find(claimAssertsPayment);

  signals.push({
    code: "suspicious_redirect",
    present: input.domainChanged,
    detail:
      input.domainChanged && input.originalDomain && input.finalDomain
        ? `The submitted URL redirected from ${input.originalDomain} to ${input.finalDomain}.`
        : "The submitted URL redirected to a different domain.",
  });

  signals.push({
    code: "payment_request",
    present: Boolean(paymentClaim),
    detail: paymentClaim
      ? `The content requests a payment: "${truncate(paymentClaim.text, 120)}".`
      : "The content requests a payment.",
  });

  signals.push({
    code: "weak_source_authority",
    present: !hasAuthoritativeSource,
    // 'Independent' on purpose: the organization's own first-party page can be
    // an authoritative WITNESS (see the Trust Engine authority gate) but it is
    // never outside corroboration, so it does not clear this signal.
    detail: hasAuthoritativeSource
      ? "An independent government or academic source was found."
      : "No independent (government or academic) source was found for this opportunity.",
  });

  const identityMismatch = organizationClaims.some(
    (claim) => claim.status === "contradicted" || claim.status === "conflicting",
  );
  signals.push({
    code: "identity_mismatch",
    present: identityMismatch,
    detail:
      "Evidence contradicts who runs this opportunity — the organization claim does not hold.",
  });

  signals.push({
    code: "unresolved_contradiction",
    present: criticalConflicting.length > 0,
    detail:
      criticalConflicting.length > 0
        ? `${criticalConflicting.length} critical claim${criticalConflicting.length === 1 ? "" : "s"} remain${criticalConflicting.length === 1 ? "s" : ""} materially contradicted without an authoritative resolution.`
        : "Critical claims materially contradict without an authoritative resolution.",
  });

  const officialConfirmationMissing =
    organizationClaims.length > 0 &&
    !organizationClaims.some((claim) => claim.status === "supported") &&
    !input.hasAuthoritativeSupport;
  signals.push({
    code: "missing_official_confirmation",
    present: officialConfirmationMissing,
    detail:
      "No official source confirms the organization behind this opportunity.",
  });

  return signals;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}
