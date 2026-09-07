/**
 * Trustlify Backend — Risk Engine
 *
 * Phase 5 (implemented with the Phase 4 pipeline): deterministic risk signal
 * detection (spec 25). These are SIGNALS, not verdicts — a single signal
 * never equals HIGH_RISK by itself. The Trust Engine weighs them.
 *
 * Signals:
 *   suspicious_redirect   — submitted URL redirected to a different domain
 *   payment_request       — the content asks for a SUSPICIOUS payment
 *   weak_source_authority — no government/academic or supported first-party
 *                           source establishes the claims
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
 * Deterministic wording that makes a payment demand suspicious. Ordinary
 * commercial pricing is not a fraud signal: a product price, membership,
 * subscription, tuition/course fee, sale, or discount can be an expected part
 * of a legitimate service. The risk signal is reserved for payments connected
 * to a promised outcome, an unusual destination/channel, or urgent pressure.
 */
const SUSPICIOUS_PAYMENT_PATTERNS: RegExp[] = [
  /\b(?:pay|payment|fee).{0,80}\b(?:guarantee|guaranteed|secure|confirm|unlock).{0,80}\b(?:acceptance|admission|selection|scholarship|grant|opportunity|seat|application)\b/i,
  /\b(?:acceptance|admission|selection|scholarship|grant|opportunity|seat|application).{0,80}\b(?:requires?|after)\s+(?:a\s+)?(?:pay|payment|fee)\b/i,
  /\b(?:crypto|bitcoin|usdt|gift\s*card|western\s+union|money\s*gram|wire\s+transfer)\b/i,
  /\b(?:personal|individual|private)\s+(?:bank\s+)?account\b/i,
  /\b(?:pay|payment|fee).{0,80}\b(?:urgent|urgently|immediately|today|within\s+\d+\s*(?:hours?|days?))\b/i,
];

/** A normal commercial transaction in the organization's stated service. */
const NORMAL_COMMERCIAL_PAYMENT_RE =
  /\b(?:price|pricing|subscription|membership|paid\s+plan|course\s+fee|tuition|checkout|discount|sale)\b/i;

const PAYMENT_PATTERNS: RegExp[] = [
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
function clauseDemandsSuspiciousPayment(clause: string): boolean {
  if (negatesPayment(clause)) return false;
  if (SUSPICIOUS_PAYMENT_PATTERNS.some((pattern) => pattern.test(clause))) return true;
  // A payment request with an unusual channel remains suspicious even if its
  // wording does not name a fee explicitly.
  return (
    PAYMENT_PATTERNS.some((pattern) => pattern.test(clause)) &&
    !NORMAL_COMMERCIAL_PAYMENT_RE.test(clause)
  );
}

/**
 * Does this claim assert a suspicious payment demand?
 *
 * A `fee` type is a topic label, not proof of fraud. It can describe an
 * ordinary subscription, tuition, course price, or official discount. Only
 * explicit suspicious context creates the strong risk signal.
 */
function claimAssertsSuspiciousPayment(claim: { text: string; type: string }): boolean {
  return clausesOf(claim.text).some(clauseDemandsSuspiciousPayment);
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
  const hasGovernmentOrAcademicSource = input.sourceTypes.some(
    (type) => type === "government" || type === "academic",
  );
  const paymentClaim = input.claims.find(claimAssertsSuspiciousPayment);

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
      ? `The content requests a suspicious payment: "${truncate(paymentClaim.text, 120)}".`
      : "The content requests a suspicious payment.",
  });

  signals.push({
    code: "weak_source_authority",
    present: !hasGovernmentOrAcademicSource && !input.hasAuthoritativeSupport,
    // Contextual authority: government/academic corroboration is strongest for
    // public and university opportunities, while analyzed, boundary-safe
    // first-party support is meaningful primary evidence for commercial sites.
    detail: hasGovernmentOrAcademicSource
      ? "An independent government or academic source was found."
      : input.hasAuthoritativeSupport
        ? "A first-party official source supports the key claims."
        : "No government, academic, or supported first-party source was found for this opportunity.",
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
