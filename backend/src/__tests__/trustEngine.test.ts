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
  isAuthoritativeSource,
  isFirstPartySource,
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

/* ─── First-party authority (surgical fix #1) ──────────────────────────────── */

describe("trustEngine — first-party authority", () => {
  /** The page the user submitted: banoqabil.org is an ordinary .org host. */
  const SUBMITTED: TrustEngineSource = {
    id: "s9",
    domain: "banoqabil.org",
    sourceType: "submitted",
  };
  /** A discovery on the same first-party host, classified only as 'unknown'. */
  const SAME_DOMAIN: TrustEngineSource = {
    id: "s8",
    domain: "banoqabil.org",
    sourceType: "unknown",
  };

  it("case A — the submitted first-party page satisfies the authority gate", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s9")],
        sources: [SUBMITTED],
        originalDomain: "banoqabil.org",
        finalDomain: "banoqabil.org",
        firstPartyDomains: ["banoqabil.org"],
      }),
    );

    // No .gov/.edu/.ac source exists — first-party support is enough
    expect(decision.verdict).toBe("VERIFIED");
    expect(decision.trustScore).toBeGreaterThanOrEqual(70);
    expect(decision.reasons).toContain(
      "Official source confirms key claims: banoqabil.org.",
    );
  });

  it("case B — a same-domain discovery is first-party without being submitted", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s8")],
        sources: [SAME_DOMAIN],
        firstPartyDomains: ["banoqabil.org"],
      }),
    );

    expect(decision.verdict).toBe("VERIFIED");
  });

  it("matches hosts safely: subdomains and www qualify, lookalikes never", () => {
    const decideFor = (domain: string) =>
      calculateTrustDecision(
        input({
          claims: [claim("c1", "supported")],
          evidence: [evidence("c1", "s8")],
          sources: [{ id: "s8", domain, sourceType: "unknown" }],
          firstPartyDomains: ["www.example.org", "apply.example.org"],
        }),
      ).verdict;

    expect(decideFor("example.org")).toBe("VERIFIED"); // www-stripped first party
    expect(decideFor("courses.example.org")).toBe("VERIFIED"); // true subdomain
    expect(decideFor("apply.example.org")).toBe("VERIFIED");
    // Boundary safety: substring/name similarity is NOT a domain match
    expect(decideFor("evil-example.org")).toBe("UNVERIFIED");
    expect(decideFor("example.org.evil.net")).toBe("UNVERIFIED");
    expect(decideFor("banoqabil-example.org")).toBe("UNVERIFIED");
  });

  it("case C — first-party source with insufficient evidence stays UNVERIFIED", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "insufficient"), claim("c2", "supported")],
        evidence: [evidence("c2", "s9")],
        sources: [SUBMITTED],
        firstPartyDomains: ["banoqabil.org"],
      }),
    );

    expect(decision.verdict).toBe("UNVERIFIED");
  });

  it("case D — an unrelated third-party domain never becomes authoritative", () => {
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s7")],
        sources: [{ id: "s7", domain: "banoqabil-alerts.net", sourceType: "unknown" }],
        firstPartyDomains: ["banoqabil.org"],
        riskSignals: signals("weak_source_authority"),
      }),
    );

    expect(decision.verdict).toBe("UNVERIFIED");
  });

  it("case E — government/academic authority still works, with or without a first party", () => {
    const noFirstParty = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s1")],
        sources: [GOV],
      }),
    );
    const withFirstParty = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s1")],
        sources: [GOV],
        firstPartyDomains: ["some-scholarship.com"],
      }),
    );

    expect(noFirstParty.verdict).toBe("VERIFIED");
    expect(withFirstParty.verdict).toBe("VERIFIED");
    expect(withFirstParty.trustScore).toBe(noFirstParty.trustScore);
  });

  it("a bare TLD is not authority — an ordinary .org/.com stays non-authoritative", () => {
    // Same .org/.com hosts as the first-party cases, but nothing was submitted
    for (const domain of ["banoqabil.org", "some-scholarship.com"]) {
      const decision = calculateTrustDecision(
        input({
          claims: [claim("c1", "supported")],
          evidence: [evidence("c1", "s8")],
          sources: [{ id: "s8", domain, sourceType: "unknown" }],
          riskSignals: signals("weak_source_authority"),
        }),
      );
      expect(decision.verdict).toBe("UNVERIFIED");
    }
  });

  it("is deterministic: the same first-party input always gives the same decision", () => {
    const build = () =>
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s9")],
        sources: [SUBMITTED],
        firstPartyDomains: ["banoqabil.org"],
      });

    expect(calculateTrustDecision(build())).toEqual(calculateTrustDecision(build()));
  });

  it("is generic across ordinary organizational domains — .org, .com, .io and .pk alike", () => {
    // No allowlist of TLDs and no domain names baked into the engine: any page
    // the user actually submitted is first-party for that investigation.
    for (const domain of ["event.example.org", "event.example.com", "event.example.io", "event.example.pk"]) {
      const decision = calculateTrustDecision(
        input({
          claims: [claim("c1", "supported")],
          evidence: [evidence("c1", "s9")],
          sources: [{ id: "s9", domain, sourceType: "submitted" }],
          firstPartyDomains: [domain],
        }),
      );
      expect(decision.verdict).toBe("VERIFIED");
      expect(decision.reasons).toContain(`Official source confirms key claims: ${domain}.`);
    }
  });
});

/* ─── Authority shared with the risk layer (surgical fix #2) ──────────────── */

describe("riskEngine — authority model shared with the Trust Engine", () => {
  const OWN_PAGE = { domain: "hackathon.example.org", sourceType: "submitted" };
  /** A discovery on the SAME host (www-prefixed), classified only as 'unknown'. */
  const SAME_HOST = { domain: "www.hackathon.example.org", sourceType: "unknown" };
  const LOOKALIKE = { domain: "hackathon-example.org", sourceType: "unknown" };
  const ORDINARY_ORG = { domain: "some-blog.org", sourceType: "unknown" };

  it("isAuthoritativeSource accepts government, academic and genuine first-party only", () => {
    const own = ["hackathon.example.org"];
    expect(isAuthoritativeSource({ domain: "hec.gov.pk", sourceType: "government" }, own)).toBe(true);
    expect(isAuthoritativeSource({ domain: "mit.edu", sourceType: "academic" }, own)).toBe(true);
    expect(isAuthoritativeSource(OWN_PAGE, own)).toBe(true);
    expect(isAuthoritativeSource(SAME_HOST, own)).toBe(true); // same host, www stripped
    // Rejected: an unrelated .org, and a name lookalike that merely contains it
    expect(isAuthoritativeSource(ORDINARY_ORG, own)).toBe(false);
    expect(isAuthoritativeSource(LOOKALIKE, own)).toBe(false);
    // Rejected: a SIBLING subdomain of the registrable domain is not the owner
    // of the submitted page — matching stays on hostname boundaries.
    expect(isAuthoritativeSource({ domain: "cdn.example.org", sourceType: "unknown" }, own)).toBe(
      false,
    );
    // Rejected: no submitted page → only gov/academic can be authoritative
    expect(isAuthoritativeSource(SAME_HOST, undefined)).toBe(false);
    expect(isAuthoritativeSource(SAME_HOST, [])).toBe(false);
  });

  it("isFirstPartySource matches hostnames on boundaries, never substrings", () => {
    const own = ["example.org"];
    expect(isFirstPartySource({ domain: "EXAMPLE.ORG", sourceType: "unknown" }, own)).toBe(true);
    expect(isFirstPartySource({ domain: "www.example.org", sourceType: "unknown" }, own)).toBe(true);
    expect(isFirstPartySource({ domain: "apply.example.org", sourceType: "unknown" }, own)).toBe(true);
    expect(isFirstPartySource({ domain: "evil-example.org", sourceType: "unknown" }, own)).toBe(false);
    expect(isFirstPartySource({ domain: "example.org.evil.net", sourceType: "unknown" }, own)).toBe(false);
    expect(isFirstPartySource({ domain: "", sourceType: "unknown" }, own)).toBe(false);
  });

  it("weak_source_authority measures INDEPENDENT corroboration — a first-party page does not clear it", () => {
    // Deliberate: the organization's own page can be an authoritative witness
    // but is never outside confirmation, so scam detection keeps its teeth.
    const result = detectRiskSignals({
      domainChanged: false,
      originalDomain: null,
      finalDomain: null,
      claims: [],
      sourceTypes: ["submitted", "unknown"],
      hasAuthoritativeSupport: true,
    });
    expect(result.find((s) => s.code === "weak_source_authority")?.present).toBe(true);
    // … while the organization claim itself IS officially confirmed (fix #1 gate)
    expect(
      result.find((s) => s.code === "missing_official_confirmation")?.present,
    ).toBe(false);
  });
});

/* ─── Payment risk is contextual, not keyword-only (surgical fix #2) ───────── */

describe("riskEngine — payment_request context", () => {
  /** The submitted first-party page, as the executor reports it. */
  const SUBMITTED: TrustEngineSource = {
    id: "s9",
    domain: "banoqabil.org",
    sourceType: "submitted",
  };
  const base = {
    domainChanged: false,
    originalDomain: null,
    finalDomain: null,
    sourceTypes: ["government"],
    hasAuthoritativeSupport: true,
  };

  function paymentFor(text: string, type = "fee"): boolean {
    const result = detectRiskSignals({
      ...base,
      claims: [{ id: "c1", text, type, importance: "critical", status: "supported" }],
    });
    return result.find((s) => s.code === "payment_request")?.present ?? false;
  }

  it("keeps flagging genuine payment demands", () => {
    // The brief's must-still-flag cases, as the pipeline delivers them: a
    // payment instruction is extracted as a 'fee' claim, and the untouched
    // payment phrasing patterns also catch demands in any other claim type.
    expect(paymentFor("Pay Rs 5,000 to register")).toBe(true);
    expect(paymentFor("Payment of Rs 5,000 is required to confirm your seat", "other")).toBe(true);
    expect(paymentFor("Registration fee is required")).toBe(true);
    expect(paymentFor("Send payment to reserve your place", "other")).toBe(true);
    expect(paymentFor("A non-refundable application fee of €25 applies")).toBe(true);
    // Refundability is about money BACK, never about it being absent
    expect(paymentFor("A non-refundable registration fee of Rs 500 applies", "other")).toBe(true);
    expect(paymentFor("The registration fee is not refundable")).toBe(true);
  });

  it("does not flag negated or free registration wording", () => {
    // The Bano Qabil shape: a 'fee' claim whose own text denies any charge.
    expect(
      paymentFor("Registration and participation in the AI Hackathon are completely free of charge"),
    ).toBe(false);
    expect(paymentFor("No registration fee is required")).toBe(false);
    expect(paymentFor("Registration is free")).toBe(false);
    expect(paymentFor("There is no application fee")).toBe(false);
    expect(paymentFor("We do not charge applicants", "other")).toBe(false);
    expect(paymentFor("The participation fee is waived for students")).toBe(false);
  });

  it("keeps a real demand when a different clause mentions free", () => {
    expect(
      paymentFor("Workshops are free of charge, but a registration fee is required to apply"),
    ).toBe(true);
    expect(paymentFor("Travel is not covered. A processing fee of Rs 500 applies.", "other")).toBe(
      true,
    );
  });

  it("a payment signal still combines with weak authority into HIGH_RISK", () => {
    // Context-awareness must not become a general HIGH_RISK weakening.
    const risky = detectRiskSignals({
      ...base,
      sourceTypes: ["submitted", "unknown"],
      hasAuthoritativeSupport: true,
      claims: [
        { id: "c1", text: "Registration fee is required", type: "fee", importance: "critical", status: "supported" },
      ],
    });
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s9")],
        sources: [SUBMITTED],
        firstPartyDomains: ["banoqabil.org"],
        riskSignals: risky,
      }),
    );
    expect(decision.verdict).toBe("HIGH_RISK");
  });

  it("a negated fee statement on the same first-party page reaches VERIFIED", () => {
    const harmless = detectRiskSignals({
      ...base,
      sourceTypes: ["submitted", "unknown"],
      hasAuthoritativeSupport: true,
      claims: [
        { id: "c1", text: "Registration and participation are free of charge", type: "fee", importance: "critical", status: "supported" },
      ],
    });
    const decision = calculateTrustDecision(
      input({
        claims: [claim("c1", "supported")],
        evidence: [evidence("c1", "s9")],
        sources: [SUBMITTED],
        firstPartyDomains: ["banoqabil.org"],
        riskSignals: harmless,
      }),
    );
    expect(harmless.find((s) => s.code === "payment_request")?.present).toBe(false);
    expect(decision.verdict).toBe("VERIFIED");
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
