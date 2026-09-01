/**
 * Trustlify Backend — Trust + Risk Engine Tests (Phase 5)
 *
 * Spec 25-30: the deterministic verdict, score, reasons, and recommended
 * action. Fixture-based only — pure functions, no AI calls, no network.
 *
 * Covers:
 *   - risk signal detection (spec 25): all six signals, present/absent
 *   - verdict rules in order (spec 27): HIGH_RISK → UNVERIFIED → CAUTION →
 *     VERIFIED → UNVERIFIED fallback
 *   - score arithmetic + band clamping (spec 28)
 *   - reasons from structured facts only (spec 29)
 *   - recommended action templates (spec 30)
 *   - determinism: identical input → identical output
 */

import { describe, it, expect } from "vitest";
import {
  calculateTrustDecision,
  type RiskSignal,
  type TrustEngineClaim,
  type TrustEngineEvidence,
  type TrustEngineInput,
  type TrustEngineSource,
} from "../engines/trustEngine.js";
import { detectRiskSignals } from "../engines/riskEngine.js";

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

const GOV: TrustEngineSource = { id: "s1", domain: "hec.gov.pk", sourceType: "government" };
const ACAD: TrustEngineSource = { id: "s2", domain: "lums.edu.pk", sourceType: "academic" };
const BLOG: TrustEngineSource = { id: "s3", domain: "blog.example.org", sourceType: "unknown" };

function claim(
  id: string,
  status: string,
  importance = "critical",
  type = "funding",
): TrustEngineClaim {
  return { id, text: `Claim ${id}`, type, importance, status };
}

function evidence(claimId: string, sourceId: string, relation = "supports"): TrustEngineEvidence {
  return { claimId, sourceId, relation, confidence: "high" };
}

/** All six signals, marked present/absent per the given codes. */
function signals(...presentCodes: string[]): RiskSignal[] {
  const catalog: [string, string][] = [
    ["suspicious_redirect", "The submitted URL redirected to a different domain."],
    ["payment_request", "The content requests a payment."],
    ["weak_source_authority", "No authoritative (government or academic) source was found for this opportunity."],
    ["identity_mismatch", "Evidence contradicts who runs this opportunity."],
    ["unresolved_contradiction", "Critical claims materially contradict without an authoritative resolution."],
    ["missing_official_confirmation", "No official source confirms the organization behind this opportunity."],
  ];
  return catalog.map(([code, detail]) => ({
    code,
    present: presentCodes.includes(code),
    detail,
  }));
}

function input(overrides: Partial<TrustEngineInput> = {}): TrustEngineInput {
  return {
    claims: [],
    evidence: [],
    sources: [],
    riskSignals: signals(),
    currentness: "unknown",
    domainChanged: false,
    originalDomain: null,
    finalDomain: null,
    ...overrides,
  };
}

/* ─── Risk signal detection (spec 25) ──────────────────────────────────────── */

describe("riskEngine — detectRiskSignals", () => {
  const base = {
    domainChanged: false,
    originalDomain: null,
    finalDomain: null,
    claims: [] as { id: string; text: string; type: string; importance: string; status: string }[],
    sourceTypes: [] as string[],
    hasAuthoritativeSupport: false,
  };

  it("always returns all six signals with present flags", () => {
    const result = detectRiskSignals(base);
    expect(result.map((s) => s.code)).toEqual([
      "suspicious_redirect",
      "payment_request",
      "weak_source_authority",
      "identity_mismatch",
      "unresolved_contradiction",
      "missing_official_confirmation",
    ]);
  });

  it("flags suspicious_redirect when the domain changed", () => {
    const result = detectRiskSignals({
      ...base,
      domainChanged: true,
      originalDomain: "example.com",
      finalDomain: "example.net",
    });
    const redirect = result.find((s) => s.code === "suspicious_redirect");
    expect(redirect?.present).toBe(true);
    expect(redirect?.detail).toContain("example.com");
    expect(redirect?.detail).toContain("example.net");
  });

  it("flags payment_request for fee claims and payment phrasing", () => {
    const fee = detectRiskSignals({
      ...base,
      claims: [claim("c1", "pending", "critical", "fee")],
    });
    expect(fee.find((s) => s.code === "payment_request")?.present).toBe(true);

    const phrasing = detectRiskSignals({
      ...base,
      claims: [
        { id: "c1", text: "Send the fee via wire transfer to confirm your seat", type: "other", importance: "supporting", status: "pending" },
      ],
    });
    expect(phrasing.find((s) => s.code === "payment_request")?.present).toBe(true);
  });

  it("flags weak_source_authority when no government/academic source exists", () => {
    const weak = detectRiskSignals({ ...base, sourceTypes: ["unknown", "social"] });
    expect(weak.find((s) => s.code === "weak_source_authority")?.present).toBe(true);

    const strong = detectRiskSignals({ ...base, sourceTypes: ["government", "unknown"] });
    expect(strong.find((s) => s.code === "weak_source_authority")?.present).toBe(false);
  });

  it("flags identity_mismatch when an organization claim is contradicted", () => {
    const result = detectRiskSignals({
      ...base,
      claims: [
        { id: "c1", text: "Run by the ABC Trust", type: "organization", importance: "critical", status: "contradicted" },
      ],
    });
    expect(result.find((s) => s.code === "identity_mismatch")?.present).toBe(true);
    // A critical contradicted claim is ALSO an unresolved contradiction —
    // both facts are true and both signals fire.
    expect(result.find((s) => s.code === "unresolved_contradiction")?.present).toBe(true);
  });

  it("flags unresolved_contradiction when a critical claim conflicts", () => {
    const result = detectRiskSignals({
      ...base,
      claims: [claim("c1", "conflicting")],
    });
    expect(result.find((s) => s.code === "unresolved_contradiction")?.present).toBe(true);
  });

  it("flags missing_official_confirmation only when an organization claim is unsupported", () => {
    const unsupported = detectRiskSignals({
      ...base,
      claims: [
        { id: "c1", text: "Run by the ABC Trust", type: "organization", importance: "critical", status: "insufficient" },
      ],
      hasAuthoritativeSupport: false,
    });
    expect(
      unsupported.find((s) => s.code === "missing_official_confirmation")?.present,
    ).toBe(true);

    const supported = detectRiskSignals({
      ...base,
      claims: [
        { id: "c1", text: "Run by the ABC Trust", type: "organization", importance: "critical", status: "supported" },
      ],
      hasAuthoritativeSupport: false,
    });
    expect(
      supported.find((s) => s.code === "missing_official_confirmation")?.present,
    ).toBe(false);
  });
});

/* ─── Verdict rules (spec 27, first match wins) ────────────────────────────── */

describe("trustEngine — verdict rules", () => {
  it("rule 4 — VERIFIED: every critical claim supported + authoritative support", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "supported")],
        evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
        sources: [GOV, ACAD],
      }),
    );

    expect(decision.verdict).toBe("VERIFIED");
    expect(decision.trustScore).toBeGreaterThanOrEqual(70);
    expect(decision.trustScore).toBeLessThanOrEqual(100);
    expect(decision.recommendedAction).toBe("Review the official source before proceeding.");
  });

  it("rule 2 — UNVERIFIED: a critical claim with insufficient evidence", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "insufficient")],
        evidence: [evidence("c1", "s1")],
        sources: [GOV],
      }),
    );

    expect(decision.verdict).toBe("UNVERIFIED");
    expect(decision.recommendedAction).toBe("Seek additional reliable evidence before acting.");
  });

  it("rule 3 — CAUTION: a critical claim is materially conflicting", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "conflicting")],
        evidence: [evidence("c1", "s1", "supports"), evidence("c1", "s2", "contradicts")],
        sources: [GOV, ACAD],
      }),
    );

    expect(decision.verdict).toBe("CAUTION");
    expect(decision.trustScore).toBeGreaterThanOrEqual(40);
    expect(decision.trustScore).toBeLessThanOrEqual(69);
    expect(decision.recommendedAction).toBe("Resolve the conflicting information before applying.");
  });

  it("rule 3 — CAUTION: a risk concern flags a partially verified opportunity", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "supported")],
        evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
        sources: [GOV, ACAD],
        riskSignals: signals("suspicious_redirect"),
      }),
    );

    expect(decision.verdict).toBe("CAUTION");
  });

  it("rule 1 — HIGH_RISK: payment request with weak source authority", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "unsupported")],
        sources: [BLOG],
        riskSignals: signals("payment_request", "weak_source_authority"),
      }),
    );

    expect(decision.verdict).toBe("HIGH_RISK");
    expect(decision.trustScore).toBeLessThanOrEqual(39);
    expect(decision.recommendedAction).toBe("Avoid submitting payment or sensitive information.");
  });

  it("rule 1 — HIGH_RISK: payment request with a suspicious redirect", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s1")],
        sources: [GOV],
        riskSignals: signals("payment_request", "suspicious_redirect"),
      }),
    );

    expect(decision.verdict).toBe("HIGH_RISK");
  });

  it("rule 1 — HIGH_RISK: identity mismatch combined with a payment request", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "unsupported")],
        sources: [BLOG],
        riskSignals: signals("identity_mismatch", "payment_request"),
      }),
    );

    expect(decision.verdict).toBe("HIGH_RISK");
  });

  it("rule 1 — HIGH_RISK: three present signals without authoritative support", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "contradicted")],
        sources: [BLOG],
        riskSignals: signals(
          "weak_source_authority",
          "unresolved_contradiction",
          "missing_official_confirmation",
        ),
      }),
    );

    expect(decision.verdict).toBe("HIGH_RISK");
  });

  it("rule 5 — UNVERIFIED fallback: supported by ordinary sources only, never forced", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s3")],
        sources: [BLOG],
        riskSignals: signals("weak_source_authority"),
      }),
    );

    expect(decision.verdict).toBe("UNVERIFIED");
  });

  it("rule 5 — UNVERIFIED fallback: no critical claims at all", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported", "supporting")],
        evidence: [evidence("c1", "s1")],
        sources: [GOV],
      }),
    );

    expect(decision.verdict).toBe("UNVERIFIED");
  });
});

/* ─── Score arithmetic + band clamping (spec 28) ───────────────────────────── */

describe("trustEngine — score", () => {
  it("computes the documented arithmetic: 50 + 8×2 supported + 10 authoritative + 5 two domains", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "supported")],
        evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
        sources: [GOV, ACAD],
      }),
    );
    // 50 + 16 + 10 + 5 = 81 — inside the VERIFIED band, no clamping
    expect(decision.trustScore).toBe(81);
  });

  it("clamps a too-high raw score into the UNVERIFIED band", () => {
    // One critical claim supported by an ordinary source: raw 50 + 8 = 58,
    // but the verdict is UNVERIFIED → clamped to the band maximum 49.
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s3")],
        sources: [BLOG],
        riskSignals: signals("weak_source_authority"),
      }),
    );
    expect(decision.trustScore).toBe(49);
  });

  it("clamps a too-high raw score into the HIGH_RISK band", () => {
    // Raw 50 + 16 + 10 = 76, but payment + redirect force HIGH_RISK → 39 max.
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "supported")],
        evidence: [evidence("c1", "s1"), evidence("c2", "s1")],
        sources: [GOV],
        riskSignals: signals("payment_request", "suspicious_redirect"),
      }),
    );
    expect(decision.trustScore).toBe(39);
  });

  it("applies deductions for unsupported, conflicting, and contradicted critical claims", () => {
    // 50 − 10 (unsupported) − 8 (weak authority) = 32; HIGH_RISK band [0,39]
    const unsupported = calculateTrustDecision(
      input({
        claims: [claim("c1", "unsupported")],
        sources: [BLOG],
        riskSignals: signals("payment_request", "weak_source_authority"),
      }),
    );
    expect(unsupported.trustScore).toBe(17); // 50 −10 −15 −8 = 17

    // 50 − 15 (conflicting) + 10 (authoritative support exists) = 45 → CAUTION
    const conflicting = calculateTrustDecision(
      input({
        claims: [claim("c1", "conflicting")],
        evidence: [evidence("c1", "s1"), evidence("c1", "s2", "contradicts")],
        sources: [GOV, ACAD],
      }),
    );
    expect(conflicting.trustScore).toBe(45);
  });

  it("adds +3 for recent currentness and −3 for dated currentness", () => {
    const base = {
      claims: [claim("c1", "supported"), claim("c2", "supported")],
      evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
      sources: [GOV, ACAD],
    };

    const recent = calculateTrustDecision(input({ ...base, currentness: "recent" }));
    const dated = calculateTrustDecision(input({ ...base, currentness: "dated" }));

    expect(recent.trustScore).toBe(84); // 81 + 3
    expect(dated.trustScore).toBe(78); // 81 − 3
  });
});

/* ─── Reasons (spec 29) ────────────────────────────────────────────────────── */

describe("trustEngine — reasons", () => {
  it("lists risk reasons first, then support, then insufficiency", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "unsupported")],
        sources: [BLOG],
        riskSignals: signals("payment_request", "weak_source_authority"),
      }),
    );

    expect(decision.reasons[0]).toBe("The content requests a payment.");
    expect(decision.reasons).toContain(
      "No authoritative (government or academic) source was found for this opportunity.",
    );
    expect(decision.reasons.some((r) => r.includes("lack"))).toBe(true);
  });

  it("names the authoritative domains that confirm key claims", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported"), claim("c2", "supported")],
        evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
        sources: [GOV, ACAD],
      }),
    );

    expect(decision.reasons).toContain(
      "Official source confirms key claims: hec.gov.pk, lums.edu.pk.",
    );
    expect(decision.reasons).toContain(
      "2 of 2 critical claims are supported by credible evidence.",
    );
  });

  it("reports honest currentness reasons", () => {
    const base = {
      claims: [claim("c1", "supported")],
      evidence: [evidence("c1", "s1")],
      sources: [GOV],
    };

    expect(
      calculateTrustDecision(input({ ...base, currentness: "recent" })).reasons,
    ).toContain("The supporting sources were published within the last year.");
    expect(
      calculateTrustDecision(input({ ...base, currentness: "dated" })).reasons,
    ).toContain("The supporting sources are more than a year old.");
    expect(
      calculateTrustDecision(input({ ...base, currentness: "unknown" })).reasons,
    ).toContain("Publication dates are unknown for the supporting sources.");
  });
});

/* ─── Explanation + determinism ────────────────────────────────────────────── */

describe("trustEngine — explanation and determinism", () => {
  const sample = input({
    claims: [claim("c1", "supported"), claim("c2", "supported")],
    evidence: [evidence("c1", "s1"), evidence("c2", "s2")],
    sources: [GOV, ACAD],
  });

  it("builds the explanation from the verdict, score, reasons, and action", () => {
    const decision = calculateTrustDecision(sample);
    expect(decision.explanation).toContain("Trustlify verdict: VERIFIED (trust score 81/100).");
    expect(decision.explanation).toContain("Recommended action: Review the official source before proceeding.");
    expect(decision.explanation).toContain("• ");
  });

  it("is a pure function: identical input → identical output", () => {
    expect(calculateTrustDecision(sample)).toEqual(calculateTrustDecision(sample));
  });
});
