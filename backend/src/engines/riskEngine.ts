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
 *   weak_source_authority — no authoritative (government/academic) source
 *   identity_mismatch     — an organization/identity claim is contradicted
 *   unresolved_contradiction — a critical claim conflicts across sources
 *   missing_official_confirmation — the organization claim is not supported
 *                           by any authoritative source
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
  /** True when at least one claim is supported by an authoritative source. */
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

function claimMentionsPayment(text: string): boolean {
  return PAYMENT_PATTERNS.some((pattern) => pattern.test(text));
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
  const paymentClaim = input.claims.find(
    (claim) => claim.type === "fee" || claimMentionsPayment(claim.text),
  );

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
    detail: hasAuthoritativeSource
      ? "An authoritative source was found."
      : "No authoritative (government or academic) source was found for this opportunity.",
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
