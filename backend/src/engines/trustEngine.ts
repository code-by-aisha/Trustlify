/**
 * Trustlify Backend — Trust Engine
 *
 * The FINAL deterministic decision engine (spec 26-30). The LLM NEVER decides
 * the verdict and NEVER produces the score — it only supplies structured
 * evidence relations, which this engine weighs with ordinary code.
 *
 * The same input ALWAYS produces the same output.
 *
 * ─── VERDICT RULES (spec 27) — first match wins ────────────────────────────
 *
 *   1. HIGH_RISK  — a strong risk pattern coexists with weak evidence:
 *        (payment_request AND (suspicious_redirect OR weak_source_authority))
 *        OR identity_mismatch with payment_request
 *        OR ≥3 risk signals present while no critical claim is
 *           supported by an authoritative source
 *
 *   2. UNVERIFIED — critical evidence is insufficient: at least one critical
 *        claim is 'insufficient' or 'unsupported' (checked, but the critical
 *        support is absent), so certainty cannot be forced.
 *
 *   3. CAUTION    — reliable sources materially conflict: a critical claim is
 *        'conflicting' (credible support AND credible contradiction), or a
 *        risk signal flags a genuine concern while the core is verified.
 *
 *   4. VERIFIED   — every critical claim is supported by credible evidence,
 *        at least one by an authoritative source, and no material
 *        contradiction exists.
 *
 *   5. UNVERIFIED (fallback) — never force certainty.
 *
 * ─── TRUST SCORE (spec 28) — 0..100 explanation aid, not proof ────────────
 *
 *   base                                                                    50
 *   +8   per supported critical claim                               (max +24)
 *   +10  authoritative (government/academic) support exists
 *   +5   ≥2 independent domains support critical claims
 *   -10  per critical claim that is 'unsupported'
 *   -15  any critical claim 'conflicting'
 *   -20  any critical claim 'contradicted'
 *   -12  suspicious_redirect signal
 *   -15  payment_request signal
 *   -8   weak_source_authority signal
 *   -6   identity_mismatch signal
 *   -8   unresolved_contradiction signal
 *   +3   currentness 'recent' · -3 'dated' · 0 'unknown'/'mixed'
 *
 *   The additive score is then clamped into the verdict's band so the number
 *   never contradicts the verdict:
 *     VERIFIED 70..100 · CAUTION 40..69 · HIGH_RISK 0..39 · UNVERIFIED 5..49
 *
 * ─── REASONS (spec 29) ─────────────────────────────────────────────────────
 *
 *   Every displayed reason is generated from structured evidence or risk
 *   signals — never generic AI filler. Reasons are ordered most-important
 *   first (risk/conflict → support → currentness).
 *
 * ─── RECOMMENDED ACTION (spec 30) — deterministic templates ────────────────
 */

import type { InvestigationCurrentnessStatus } from "./currentnessEngine.js";

export type Verdict = "VERIFIED" | "CAUTION" | "HIGH_RISK" | "UNVERIFIED";

export interface RiskSignal {
  code: string;
  present: boolean;
  detail: string;
}

export interface TrustEngineClaim {
  id: string;
  text: string;
  type: string;
  importance: string;
  status: string;
}

export interface TrustEngineEvidence {
  claimId: string;
  sourceId: string;
  relation: string;
  confidence: string;
}

export interface TrustEngineSource {
  id: string;
  domain: string;
  sourceType: string;
}

export interface TrustEngineInput {
  claims: TrustEngineClaim[];
  evidence: TrustEngineEvidence[];
  sources: TrustEngineSource[];
  riskSignals: RiskSignal[];
  currentness: InvestigationCurrentnessStatus;
  domainChanged: boolean;
  originalDomain: string | null;
  finalDomain: string | null;
}

export interface TrustDecision {
  verdict: Verdict;
  trustScore: number;
  reasons: string[];
  recommendedAction: string;
  explanation: string;
}

const RECOMMENDED_ACTIONS: Record<Verdict, string> = {
  VERIFIED: "Review the official source before proceeding.",
  CAUTION: "Resolve the conflicting information before applying.",
  HIGH_RISK: "Avoid submitting payment or sensitive information.",
  UNVERIFIED: "Seek additional reliable evidence before acting.",
};

function isAuthoritative(sourceType: string): boolean {
  return sourceType === "government" || sourceType === "academic";
}

function signal(signals: RiskSignal[], code: string): boolean {
  return signals.some((entry) => entry.code === code && entry.present);
}

function signalDetail(signals: RiskSignal[], code: string): string | null {
  const entry = signals.find((item) => item.code === code && item.present);
  return entry ? entry.detail : null;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/* ─── Verdict ─────────────────────────────────────────────────────────────── */

function decideVerdict(
  input: TrustEngineInput,
  facts: {
    criticalClaims: TrustEngineClaim[];
    criticalSupported: TrustEngineClaim[];
    criticalConflicting: TrustEngineClaim[];
    criticalContradicted: TrustEngineClaim[];
    criticalUnresolved: TrustEngineClaim[];
    authoritativeSupport: boolean;
  },
): Verdict {
  const paymentRequest = signal(input.riskSignals, "payment_request");
  const suspiciousRedirect = signal(input.riskSignals, "suspicious_redirect");
  const weakAuthority = signal(input.riskSignals, "weak_source_authority");
  const identityMismatch = signal(input.riskSignals, "identity_mismatch");
  const presentSignals = input.riskSignals.filter((s) => s.present).length;

  // Rule 1 — HIGH_RISK: strong risk pattern with weak evidence
  const strongRiskPattern =
    (paymentRequest && (suspiciousRedirect || weakAuthority)) ||
    (identityMismatch && paymentRequest) ||
    (presentSignals >= 3 && !facts.authoritativeSupport);

  if (strongRiskPattern) {
    return "HIGH_RISK";
  }

  // Rule 2 — UNVERIFIED: critical evidence is insufficient
  if (facts.criticalUnresolved.length > 0) {
    return "UNVERIFIED";
  }

  // Rule 3 — CAUTION: reliable sources materially conflict, or a genuine
  // risk concern flags a partially verified opportunity
  const materialConflict = facts.criticalConflicting.length > 0;
  const concernWithPartialSupport =
    facts.criticalSupported.length > 0 &&
    (suspiciousRedirect || identityMismatch || paymentRequest);

  if (materialConflict || concernWithPartialSupport) {
    return "CAUTION";
  }

  // Rule 4 — VERIFIED: strong authoritative support, no material contradiction
  const allCriticalSupported =
    facts.criticalClaims.length > 0 &&
    facts.criticalSupported.length === facts.criticalClaims.length;
  if (allCriticalSupported && facts.authoritativeSupport) {
    return "VERIFIED";
  }

  // Rule 5 — never force certainty
  return "UNVERIFIED";
}

/* ─── Score ───────────────────────────────────────────────────────────────── */

const SCORE_BANDS: Record<Verdict, [number, number]> = {
  VERIFIED: [70, 100],
  CAUTION: [40, 69],
  HIGH_RISK: [0, 39],
  UNVERIFIED: [5, 49],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateScore(input: TrustEngineInput, verdict: Verdict): number {
  const critical = input.claims.filter((claim) => claim.importance === "critical");
  const supported = critical.filter((claim) => claim.status === "supported");
  const conflicting = critical.filter((claim) => claim.status === "conflicting");
  const contradicted = critical.filter((claim) => claim.status === "contradicted");
  const unsupported = critical.filter((claim) => claim.status === "unsupported");

  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const supportedSourceIds = new Set(
    input.evidence
      .filter((item) => item.relation === "supports")
      .map((item) => item.sourceId),
  );
  const authoritativeSupport = input.sources.some(
    (source) =>
      isAuthoritative(source.sourceType) && supportedSourceIds.has(source.id),
  );
  const supportDomains = new Set(
    input.evidence
      .filter((item) => item.relation === "supports")
      .map((item) => sourceById.get(item.sourceId)?.domain)
      .filter((domain): domain is string => Boolean(domain)),
  );

  let score = 50;
  score += Math.min(supported.length, 3) * 8;
  if (authoritativeSupport) score += 10;
  if (supportDomains.size >= 2) score += 5;
  score -= unsupported.length * 10;
  if (conflicting.length > 0) score -= 15;
  if (contradicted.length > 0) score -= 20;

  if (signal(input.riskSignals, "suspicious_redirect")) score -= 12;
  if (signal(input.riskSignals, "payment_request")) score -= 15;
  if (signal(input.riskSignals, "weak_source_authority")) score -= 8;
  if (signal(input.riskSignals, "identity_mismatch")) score -= 6;
  if (signal(input.riskSignals, "unresolved_contradiction")) score -= 8;

  if (input.currentness === "recent") score += 3;
  if (input.currentness === "dated") score -= 3;

  const [min, max] = SCORE_BANDS[verdict];
  return Math.round(clamp(score, min, max));
}

/* ─── Reasons ─────────────────────────────────────────────────────────────── */

const MAX_REASONS = 8;

function buildReasons(input: TrustEngineInput): string[] {
  const reasons: string[] = [];
  const critical = input.claims.filter((claim) => claim.importance === "critical");
  const supportedSourceIds = new Set(
    input.evidence
      .filter((item) => item.relation === "supports")
      .map((item) => item.sourceId),
  );
  const authoritativeDomains = input.sources
    .filter(
      (source) =>
        isAuthoritative(source.sourceType) && supportedSourceIds.has(source.id),
    )
    .map((source) => source.domain);

  // Risk and conflict reasons first — most important to a decision maker
  // (weak_source_authority last: it is the mildest signal and only matters
  // when nothing stronger is present)
  for (const code of [
    "suspicious_redirect",
    "payment_request",
    "identity_mismatch",
    "unresolved_contradiction",
    "missing_official_confirmation",
    "weak_source_authority",
  ]) {
    const detail = signalDetail(input.riskSignals, code);
    if (detail) reasons.push(detail);
  }

  const conflicting = critical.filter((claim) => claim.status === "conflicting");
  for (const claim of conflicting) {
    reasons.push(
      `A critical claim is contradicted by other evidence: "${truncate(claim.text, 90)}".`,
    );
  }

  // Support reasons
  if (authoritativeDomains.length > 0) {
    reasons.push(
      `Official source confirms key claims: ${[...new Set(authoritativeDomains)].join(", ")}.`,
    );
  }
  const supported = critical.filter((claim) => claim.status === "supported");
  if (supported.length > 0) {
    reasons.push(
      `${supported.length} of ${critical.length} critical claim${supported.length === 1 ? " is" : "s are"} supported by credible evidence.`,
    );
  }

  // Insufficiency reasons
  const unresolved = critical.filter(
    (claim) => claim.status === "insufficient" || claim.status === "unsupported",
  );
  if (unresolved.length > 0) {
    reasons.push(
      `${unresolved.length} critical claim${unresolved.length === 1 ? "" : "s"} lack${unresolved.length === 1 ? "s" : ""} reliable evidence: "${truncate(unresolved[0].text, 80)}"${unresolved.length > 1 ? " and others" : ""}.`,
    );
  }

  // Currentness reason — honest, only where dates exist
  if (input.currentness === "recent") {
    reasons.push("The supporting sources were published within the last year.");
  } else if (input.currentness === "dated") {
    reasons.push("The supporting sources are more than a year old.");
  } else if (input.currentness === "mixed") {
    reasons.push("The supporting sources mix recent and dated publications.");
  } else if (critical.length > 0) {
    reasons.push("Publication dates are unknown for the supporting sources.");
  }

  return reasons.slice(0, MAX_REASONS);
}

/* ─── Main entry point ────────────────────────────────────────────────────── */

/**
 * Calculate the deterministic trust decision from structured facts.
 * Pure function: identical input → identical output, always.
 */
export function calculateTrustDecision(input: TrustEngineInput): TrustDecision {
  const critical = input.claims.filter((claim) => claim.importance === "critical");
  const criticalSupported = critical.filter((claim) => claim.status === "supported");
  const criticalConflicting = critical.filter((claim) => claim.status === "conflicting");
  const criticalContradicted = critical.filter(
    (claim) => claim.status === "contradicted",
  );
  const criticalUnresolved = critical.filter(
    (claim) => claim.status === "insufficient" || claim.status === "unsupported",
  );

  const supportedSourceIds = new Set(
    input.evidence
      .filter((item) => item.relation === "supports")
      .map((item) => item.sourceId),
  );
  const authoritativeSupport = input.sources.some(
    (source) =>
      isAuthoritative(source.sourceType) && supportedSourceIds.has(source.id),
  );

  const verdict = decideVerdict(input, {
    criticalClaims: critical,
    criticalSupported,
    criticalConflicting,
    criticalContradicted,
    criticalUnresolved,
    authoritativeSupport,
  });

  const trustScore = calculateScore(input, verdict);
  const reasons = buildReasons(input);
  const recommendedAction = RECOMMENDED_ACTIONS[verdict];

  const explanation = [
    `Trustlify verdict: ${verdict} (trust score ${trustScore}/100).`,
    ...reasons.map((reason) => `• ${reason}`),
    `Recommended action: ${recommendedAction}`,
  ].join("\n");

  return { verdict, trustScore, reasons, recommendedAction, explanation };
}
