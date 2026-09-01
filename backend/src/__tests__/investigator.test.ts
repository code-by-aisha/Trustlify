/**
 * Trustlify Backend — Investigator Tests (Phase 4)
 *
 * Spec 20/21/23: validation of the ONE evidence-analysis call's output and the
 * deterministic derivation of claim statuses. Fixture-based only — the AI
 * provider is a fake; no network calls.
 *
 * Covers:
 *   - excerpt verification (whitespace-insensitive, verbatim-only)
 *   - fabricated excerpts: supports/contradicts downgraded to insufficient,
 *     neutral/insufficient rejected outright (spec 21)
 *   - reference validation: unknown ids and duplicate (claim, source) pairs
 *   - claim status derivation: SUPPORTED / CONFLICTING / CONTRADICTED /
 *     UNSUPPORTED / INSUFFICIENT with the deterministic credibility model
 *   - the one-call orchestration: analysis result + error propagation
 */

import { describe, it, expect } from "vitest";
import {
  excerptExistsInContent,
  normalizeWhitespace,
  validateEvidenceAnalysis,
  deriveClaimStatuses,
  analyzeEvidenceAndValidate,
  EXCERPT_UNVERIFIED_REASON,
  type InvestigatorClaim,
  type InvestigatorSource,
  type VerifiedEvidence,
} from "../investigation/investigator.js";
import { AIError } from "../ai/errors.js";
import type { AnalyzedEvidenceItem } from "../ai/AIProvider.js";

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

const CLAIMS: InvestigatorClaim[] = [
  {
    id: "c1",
    text: "The XYZ scholarship is fully funded",
    type: "funding",
    importance: "critical",
  },
  {
    id: "c2",
    text: "Applications close on September 15, 2026",
    type: "deadline",
    importance: "critical",
  },
];

const GOV_CONTENT =
  "The XYZ scholarship is fully funded. Applications close on September 15, 2026.";

function govSource(
  id = "s1",
  content = GOV_CONTENT,
  domain = "hec.gov.pk",
): InvestigatorSource {
  return {
    id,
    url: `https://${domain}/page`,
    title: "Official page",
    domain,
    sourceType: "government",
    content,
  };
}

function blogSource(id: string, domain: string): InvestigatorSource {
  return {
    id,
    url: `https://${domain}/post`,
    title: "Blog post",
    domain,
    sourceType: "unknown",
    content: `Content from ${domain}: ${GOV_CONTENT}`,
  };
}

function item(overrides: Partial<AnalyzedEvidenceItem>): AnalyzedEvidenceItem {
  return {
    claimId: "c1",
    sourceId: "s1",
    relation: "supports",
    excerpt: "The XYZ scholarship is fully funded",
    reason: "The source states the claim directly.",
    confidence: "high",
    ...overrides,
  };
}

/* ─── Excerpt verification (spec 21) ───────────────────────────────────────── */

describe("excerptExistsInContent", () => {
  it("matches a verbatim excerpt", () => {
    expect(excerptExistsInContent("fully funded", GOV_CONTENT)).toBe(true);
  });

  it("matches across whitespace differences (line breaks collapse)", () => {
    const content = "The XYZ scholarship\n\n   is fully funded.";
    expect(excerptExistsInContent("The XYZ scholarship is fully funded", content)).toBe(
      true,
    );
  });

  it("rejects an empty excerpt", () => {
    expect(excerptExistsInContent("", GOV_CONTENT)).toBe(false);
  });

  it("rejects text that does not appear in the content", () => {
    expect(
      excerptExistsInContent("This quotation appears nowhere in the source.", GOV_CONTENT),
    ).toBe(false);
  });

  it("normalizeWhitespace collapses every whitespace run", () => {
    expect(normalizeWhitespace("  a \n\t b   c ")).toBe("a b c");
  });
});

/* ─── Validation of model output (spec 21) ─────────────────────────────────── */

describe("validateEvidenceAnalysis", () => {
  it("keeps a verbatim supports item as approved evidence", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [item({})],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(rejectedCount).toBe(0);
    expect(evidence).toEqual(<VerifiedEvidence[]>[
      {
        claimId: "c1",
        sourceId: "s1",
        relation: "supports",
        excerpt: "The XYZ scholarship is fully funded",
        reason: "The source states the claim directly.",
        confidence: "high",
        verificationStatus: "approved",
      },
    ]);
  });

  it("verifies an excerpt whose whitespace differs from the source content", () => {
    const { evidence } = validateEvidenceAnalysis({
      candidates: [
        item({
          excerpt: "The XYZ scholarship is fully funded.   Applications close on September 15, 2026.",
        }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });
    expect(evidence[0]?.verificationStatus).toBe("approved");
    expect(evidence[0]?.relation).toBe("supports");
  });

  it("downgrades a supports relation with a fabricated excerpt to insufficient", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({
          excerpt: "This quotation does not appear anywhere in the source content.",
        }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(rejectedCount).toBe(0); // downgraded, not dropped
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      relation: "insufficient",
      excerpt: "",
      reason: EXCERPT_UNVERIFIED_REASON,
      confidence: "low",
      verificationStatus: "uncertain",
    });
  });

  it("downgrades a contradicts relation with a fabricated excerpt to insufficient", () => {
    const { evidence } = validateEvidenceAnalysis({
      candidates: [
        item({
          relation: "contradicts",
          excerpt: "The scholarship was cancelled last year.",
        }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(evidence[0]?.relation).toBe("insufficient");
    expect(evidence[0]?.verificationStatus).toBe("uncertain");
  });

  it("rejects a neutral item carrying a fabricated excerpt entirely", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({ relation: "neutral", excerpt: "Made-up quotation in nowhere." }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(evidence).toHaveLength(0);
    expect(rejectedCount).toBe(1);
  });

  it("rejects an insufficient item carrying a fabricated excerpt entirely", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({ relation: "insufficient", excerpt: "Also fabricated." }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(evidence).toHaveLength(0);
    expect(rejectedCount).toBe(1);
  });

  it("keeps an insufficient item with an empty excerpt as approved", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({ relation: "insufficient", excerpt: "", reason: "Nothing relevant." }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(rejectedCount).toBe(0);
    expect(evidence[0]).toMatchObject({
      relation: "insufficient",
      verificationStatus: "approved",
    });
  });

  it("rejects items referencing unknown claims or sources", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({ claimId: "c-nope" }),
        item({ sourceId: "s-nope" }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(evidence).toHaveLength(0);
    expect(rejectedCount).toBe(2);
  });

  it("collapses duplicate (claim, source) pairs to the first occurrence", () => {
    const { evidence, rejectedCount } = validateEvidenceAnalysis({
      candidates: [
        item({ reason: "first" }),
        item({ reason: "second, duplicate pair" }),
      ],
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.reason).toBe("first");
    expect(rejectedCount).toBe(1);
  });
});

/* ─── Claim status derivation (spec 23) ────────────────────────────────────── */

describe("deriveClaimStatuses", () => {
  it("marks claims with no evidence as insufficient", () => {
    const statuses = deriveClaimStatuses({
      claims: CLAIMS,
      evidence: [],
      sources: [govSource()],
    });

    expect(statuses.map((s) => s.status)).toEqual(["insufficient", "insufficient"]);
    expect(statuses[0]?.reasoningSummary).toBe(
      "No reliable evidence was found for this claim.",
    );
  });

  it("marks a claim supported by an authoritative source as supported", () => {
    const statuses = deriveClaimStatuses({
      claims: CLAIMS,
      evidence: [
        {
          claimId: "c1",
          sourceId: "s1",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "Direct statement.",
          confidence: "medium",
          verificationStatus: "approved",
        },
      ],
      sources: [govSource()],
    });

    // Authoritative sources are credible at any confidence
    expect(statuses[0]?.status).toBe("supported");
    expect(statuses[0]?.reasoningSummary).toBe("Supported by hec.gov.pk.");
    expect(statuses[1]?.status).toBe("insufficient");
  });

  it("never lets a social source establish support on its own", () => {
    const social: InvestigatorSource = {
      id: "s9",
      url: "https://facebook.com/post",
      title: "Post",
      domain: "facebook.com",
      sourceType: "social",
      content: GOV_CONTENT,
    };
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s9",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "Post says so.",
          confidence: "high",
          verificationStatus: "approved",
        },
      ],
      sources: [social],
    });

    // Evidence was checked, but social media is not credible on its own
    expect(statuses[0]?.status).toBe("unsupported");
  });

  it("establishes support from two independent ordinary domains at medium+ confidence", () => {
    const sources = [blogSource("s3", "blog-one.example.org"), blogSource("s4", "blog-two.example.org")];
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s3",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "States it.",
          confidence: "medium",
          verificationStatus: "approved",
        },
        {
          claimId: "c1",
          sourceId: "s4",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "Confirms it.",
          confidence: "medium",
          verificationStatus: "approved",
        },
      ],
      sources,
    });

    expect(statuses[0]?.status).toBe("supported");
    expect(statuses[0]?.reasoningSummary).toBe("Supported by independent sources.");
  });

  it("does not establish support from a single low-confidence ordinary source", () => {
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s3",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "States it.",
          confidence: "low",
          verificationStatus: "approved",
        },
      ],
      sources: [blogSource("s3", "blog.example.org")],
    });

    expect(statuses[0]?.status).toBe("unsupported");
  });

  it("marks a claim with credible support AND credible contradiction as conflicting", () => {
    const other: InvestigatorSource = {
      ...govSource("s2", "The XYZ scholarship was cancelled for 2026.", "lums.edu.pk"),
    };
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s1",
          relation: "supports",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "Confirms.",
          confidence: "high",
          verificationStatus: "approved",
        },
        {
          claimId: "c1",
          sourceId: "s2",
          relation: "contradicts",
          excerpt: "The XYZ scholarship was cancelled for 2026.",
          reason: "Denies.",
          confidence: "high",
          verificationStatus: "approved",
        },
      ],
      sources: [govSource(), other],
    });

    expect(statuses[0]?.status).toBe("conflicting");
    expect(statuses[0]?.reasoningSummary).toContain("supported by hec.gov.pk");
    expect(statuses[0]?.reasoningSummary).toContain("contradicted by lums.edu.pk");
  });

  it("marks a claim contradicted by an authoritative source as contradicted", () => {
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s1",
          relation: "contradicts",
          excerpt: "The XYZ scholarship is fully funded",
          reason: "The page states the opposite.",
          confidence: "high",
          verificationStatus: "approved",
        },
      ],
      sources: [govSource()],
    });

    expect(statuses[0]?.status).toBe("contradicted");
    expect(statuses[0]?.reasoningSummary).toBe("Contradicted by hec.gov.pk.");
  });

  it("marks a claim with only neutral evidence as unsupported", () => {
    const statuses = deriveClaimStatuses({
      claims: [CLAIMS[0]],
      evidence: [
        {
          claimId: "c1",
          sourceId: "s1",
          relation: "neutral",
          excerpt: "",
          reason: "Nothing about funding.",
          confidence: "low",
          verificationStatus: "approved",
        },
      ],
      sources: [govSource()],
    });

    expect(statuses[0]?.status).toBe("unsupported");
  });
});

/* ─── One-call orchestration (spec 20) ─────────────────────────────────────── */

describe("analyzeEvidenceAndValidate", () => {
  it("returns validated evidence and claim statuses from one provider call", async () => {
    const ai = {
      analyzeEvidence: async () => ({
        evidence: [
          {
            claimId: "c1",
            sourceId: "s1",
            relation: "supports",
            excerpt: "The XYZ scholarship is fully funded",
            reason: "Stated directly.",
            confidence: "high",
          },
          {
            claimId: "c1",
            sourceId: "s1",
            relation: "supports",
            excerpt: "Duplicate pair.",
            reason: "Should be dropped.",
            confidence: "high",
          },
        ],
      }),
    };

    const result = await analyzeEvidenceAndValidate({
      ai,
      claims: CLAIMS,
      sources: [govSource()],
    });

    expect(result.evidence).toHaveLength(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.claimStatuses[0]?.status).toBe("supported");
    expect(result.claimStatuses[1]?.status).toBe("insufficient");
  });

  it("propagates provider failures — nothing is invented (spec 33)", async () => {
    const ai = {
      analyzeEvidence: async () => {
        throw new AIError("AI_MALFORMED_OUTPUT", "invalid JSON from the model");
      },
    };

    await expect(
      analyzeEvidenceAndValidate({ ai, claims: CLAIMS, sources: [govSource()] }),
    ).rejects.toBeInstanceOf(AIError);
  });

  it("passes the source passages to the provider fenced as plain data", async () => {
    const seen: { passages?: { text: string }[] } = {};
    const ai = {
      analyzeEvidence: async (input: { passages: { text: string }[] }) => {
        seen.passages = input.passages;
        return { evidence: [] };
      },
    };

    await analyzeEvidenceAndValidate({ ai, claims: CLAIMS, sources: [govSource()] });

    expect(seen.passages?.[0]?.text).toBe(GOV_CONTENT);
  });
});
