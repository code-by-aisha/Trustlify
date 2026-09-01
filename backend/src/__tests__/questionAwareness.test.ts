/**
 * Trustlify — Multi-question update focused tests (update spec 07/08, 26)
 *
 * Deterministic only: no Gemini, no Tavily, no network. The similar-opportunity
 * intent is asserted on its *preview* — this file never runs a search (the
 * search ceiling is proven in similarOpportunities.test.ts with an injected
 * provider).
 */

import { describe, it, expect } from "vitest";
import { classifyQuestionIntent } from "../investigation/questionIntent.js";
import {
  DEFAULT_SECTION_ORDER,
  deriveStudentIntelligence,
  sectionOrderFor,
  type IntelligenceSectionKey,
  type StudentIntelligence,
} from "../services/studentIntelligenceService.js";
import type { StudentProfileFacts } from "../engines/studentMatcher.js";

/** Fixed clock — every date assertion is independent of the real day. */
const NOW = new Date("2026-08-31T12:00:00Z");

const STUDENT: StudentProfileFacts = {
  role: "student",
  education: "BSc Computer Science",
  educationLevel: "UNDERGRADUATE",
  country: "Pakistan",
  fieldOfStudy: "Computer Science",
  age: 21,
  location: "Islamabad",
  skills: ["Python", "Research"],
  interests: ["Machine Learning"],
  experience: "1 year of teaching experience",
  language: "English",
};

const CLAIMS = [
  {
    id: "c1",
    type: "eligibility",
    text: "Open to Pakistani students only",
    status: "supported",
    importance: "critical",
  },
  {
    id: "c2",
    type: "eligibility",
    text: "Minimum age 18 years",
    status: "supported",
    importance: "important",
  },
  {
    id: "c3",
    type: "deadline",
    text: "The last date to apply is 31 Dec 2026",
    status: "insufficient",
    importance: "supporting",
  },
];

const SOURCES = [
  {
    id: "s1",
    url: "https://hec.gov.pk/fellowship",
    title: "HEC Fellowship 2026",
    domain: "hec.gov.pk",
    sourceType: "government",
    publishedAt: "2026-06-01T00:00:00Z",
    retrievedAt: "2026-08-31T00:00:00Z",
    accessStatus: "available",
  },
];

function derive(
  question: string | null,
  overrides: Partial<Parameters<typeof deriveStudentIntelligence>[0]> = {},
): StudentIntelligence {
  return deriveStudentIntelligence({
    investigationQuestion: question,
    claims: CLAIMS,
    sources: SOURCES,
    evidence: [{ sourceId: "s1", relation: "supports", confidence: "high" }],
    decision: {
      verdict: "VERIFIED",
      trustScore: 78,
      recommendedAction: ["Verify the organiser's official website before applying."],
      reasons: ["The critical claims are supported by an authoritative source."],
    },
    profile: STUDENT,
    now: NOW,
    ...overrides,
  });
}

/* ─── 1. Seven intents, keyword rules only (spec 07) ──────────────────────── */

describe("seven question intents (no model call)", () => {
  it("classifies every supported intent from a natural student question", () => {
    expect(classifyQuestionIntent("Can you show me similar opportunities I may be eligible for?")).toBe(
      "SIMILAR_OPPORTUNITIES",
    );
    expect(classifyQuestionIntent("Am I eligible for this scholarship?")).toBe("ELIGIBILITY");
    expect(classifyQuestionIntent("What is the last date to apply?")).toBe("DEADLINE");
    expect(classifyQuestionIntent("Is this outdated?")).toBe("CURRENTNESS");
    expect(classifyQuestionIntent("Is this genuine or a scam?")).toBe("LEGITIMACY");
    expect(classifyQuestionIntent("Can you explain this in simple words?")).toBe("EXPLANATION");
    expect(classifyQuestionIntent("Check this link for me please")).toBe("GENERAL");
  });

  it("keeps a deterministic single primary intent when a sentence matches several", () => {
    // Asks for alternatives AND eligibility — the request for a list wins, and
    // it always wins, because rule order decides, not randomness.
    expect(classifyQuestionIntent("Show me similar scholarships I am eligible for")).toBe(
      "SIMILAR_OPPORTUNITIES",
    );
    // Eligibility before deadline, as in the earlier live question.
    expect(classifyQuestionIntent("Can I apply for this, and am I eligible?")).toBe("ELIGIBILITY");
    expect(classifyQuestionIntent("Can I apply, or is the last date gone?")).toBe("ELIGIBILITY");
  });

  it("is stable across repeats and casing", () => {
    const once = classifyQuestionIntent("IS THIS REAL?");
    expect(classifyQuestionIntent("is this real?")).toBe(once);
    expect(once).toBe("LEGITIMACY");
  });
});

/* ─── 2. Question-aware presentation order (spec 08) ──────────────────────── */

const ALL_SECTIONS: IntelligenceSectionKey[] = [
  "currentness",
  "match",
  "recommendedSource",
  "verdictReasons",
  "actions",
];

describe("question-aware section priority", () => {
  it("puts what the student asked about first, for each of the five examples", () => {
    // "What is the deadline?" → deadline/currentness first, then the source.
    expect(sectionOrderFor("DEADLINE").slice(0, 2)).toEqual(["currentness", "recommendedSource"]);
    // "Is this real?" → verdict reasoning, then the authoritative source.
    expect(sectionOrderFor("LEGITIMACY").slice(0, 2)).toEqual(["verdictReasons", "recommendedSource"]);
    // "Am I eligible?" → the match (which holds matched/missing/unknown), then dates.
    expect(sectionOrderFor("ELIGIBILITY")).toEqual([
      "match",
      "currentness",
      "recommendedSource",
      "verdictReasons",
      "actions",
    ]);
    // "Can you explain this?" → verified facts/reasoning first, action last.
    expect(sectionOrderFor("EXPLANATION")).toEqual([
      "verdictReasons",
      "recommendedSource",
      "currentness",
      "match",
      "actions",
    ]);
    // "Anything similar?" → fit first, then where to verify.
    expect(sectionOrderFor("SIMILAR_OPPORTUNITIES").slice(0, 2)).toEqual([
      "match",
      "recommendedSource",
    ]);
  });

  it("never drops, duplicates or invents a section", () => {
    for (const intent of [
      "ELIGIBILITY",
      "DEADLINE",
      "CURRENTNESS",
      "LEGITIMACY",
      "EXPLANATION",
      "SIMILAR_OPPORTUNITIES",
      "GENERAL",
      null,
    ] as const) {
      const order = sectionOrderFor(intent);
      expect([...order].sort()).toEqual([...ALL_SECTIONS].sort());
      expect(new Set(order).size).toBe(ALL_SECTIONS.length);
    }
  });

  it("falls back to the pre-update order with no question", () => {
    expect(sectionOrderFor(null)).toEqual(DEFAULT_SECTION_ORDER);
    expect(sectionOrderFor("GENERAL")).toEqual(DEFAULT_SECTION_ORDER);
    // …and the derivation carries it, so the page needs no extra logic.
    expect(derive(null).emphasis).toEqual(DEFAULT_SECTION_ORDER);
    expect(derive("Am I eligible for this?").emphasis[0]).toBe("match");
  });
});

/* ─── 3. EXPLANATION — facts, then caveats, all from stored statuses ──────── */

describe("EXPLANATION answer", () => {
  it("summarises the claims the evidence confirmed and states what stayed open", () => {
    const result = derive("Can you explain this to me?");
    expect(result.intent).toBe("EXPLANATION");

    const [first, second, third] = result.answer;
    expect(first).toContain("Open to Pakistani students only");
    expect(first).toContain("Minimum age 18 years");
    // The one claim that never reached 'supported' is named as a caveat, not hidden.
    expect(second).toContain("Caveat: 1 of 3 claims stayed unconfirmed");
    // The verdict is attributed to code, not to the AI prose.
    expect(third).toContain("VERIFIED");
    expect(third).toContain("calculated by code, not by the AI");
    // Wording that no longer holds for this run is not produced.
    expect(result.answer.join(" ")).not.toContain("conflict with other evidence");
  });

  it("reports contradicted claims as conflicts instead of smoothing them over", () => {
    const result = derive("Please explain this", {
      claims: CLAIMS.map((claim) =>
        claim.id === "c2" ? { ...claim, status: "contradicted" } : claim,
      ),
    });
    expect(result.answer.join(" ")).toContain("1 of them conflict with other evidence");
  });

  it("says so when nothing was confirmed — an empty summary is the honest answer", () => {
    const result = derive("Explain this", {
      claims: CLAIMS.map((claim) => ({ ...claim, status: "insufficient" })),
      decision: null,
    });
    expect(result.answer[0]).toContain("Nothing in this content was confirmed");
    // No verdict exists, so none is quoted.
    expect(result.answer.join(" ")).not.toContain("trust score");
  });
});

/* ─── 4. SIMILAR_OPPORTUNITIES — preview only, no search on read ──────────── */

describe("SIMILAR_OPPORTUNITIES answer", () => {
  it("states the search ceiling and the deterministic queries without searching", () => {
    const result = derive("Can you show me similar opportunities that I may be eligible for?");

    expect(result.intent).toBe("SIMILAR_OPPORTUNITIES");
    expect(result.answer[0]).toContain("will not invent alternatives");
    expect(result.answer[0]).toContain("at most 2 searches");

    // Queries are built from the student's own structured fields and this content.
    const joined = result.answer.join(" ");
    expect(joined).toContain("built by code from your own profile");
    expect(joined).toContain("“scholarship Computer Science for Pakistan students undergraduate 2026”");
    expect(joined).toContain("“scholarship python research Pakistan applications open 2027”");
    // The candidate count is not promised, and eligibility is not claimed here.
    expect(joined).not.toMatch(/you are eligible/i);
  });

  it("does not build queries for a student who is not asking for alternatives", () => {
    const asking = derive("Can you show me similar opportunities?");
    const other = derive("Can you explain this to me?");
    expect(asking.answer.join(" ")).toContain("scholarship");
    expect(other.answer.join(" ")).not.toContain("applications open");
  });

  it("says a saved student profile is required before any candidate is called a fit", () => {
    const result = derive("Show me similar scholarships", {
      profile: { ...STUDENT, role: "general" },
    });
    expect(result.answer.join(" ")).toContain("needs a saved student profile");
    // No profile-shaped query is leaked into the answer for a general user.
    expect(result.answer.join(" ")).not.toContain("applications open");
  });
});

/* ─── 5. Conflicting dates are surfaced in the answer prose (spec 08) ─────── */

describe("conflicting dates in answers", () => {
  const conflicting = [
    { id: "c1", type: "deadline", text: "Last date to apply is 15 Aug 2026", status: "supported" },
    { id: "c2", type: "deadline", text: "Deadline extended to 30 Nov 2026", status: "supported" },
  ];

  it("names both dates for a CURRENTNESS question", () => {
    const result = derive("Is this still valid or outdated?", { claims: conflicting });
    expect(result.currentness.deadline.state).toBe("CONFLICTING");
    const joined = result.answer.join(" ");
    expect(joined).toContain("2 different dates");
    // Both spellings are there: the readable dates in the assessment line, the
    // exact ISO values in the conflict line.
    expect(joined).toContain("15 Aug 2026");
    expect(joined).toContain("2026-08-15");
    expect(joined).toContain("instead of picking one");
  });

  it("names both dates for a DEADLINE question", () => {
    const result = derive("What is the last date to apply?", { claims: conflicting });
    expect(result.intent).toBe("DEADLINE");
    expect(result.answer.join(" ")).toContain("Trustlify reports the conflict");
  });

  it("stays silent about conflicts when the content holds one date", () => {
    const result = derive("What is the deadline?");
    expect(result.answer.join(" ")).not.toContain("different dates");
    expect(result.answer[0]).toContain("31 Dec 2026");
  });
});

/* ─── 6. Eligibility wording + the deadline-inflation guard ───────────────── */

describe("ELIGIBILITY answer and score honesty", () => {
  it("names blockers and unconfirmed items separately", () => {
    const result = derive("Am I eligible for this?", {
      claims: [
        { id: "c1", type: "eligibility", text: "Open to applicants from Bangladesh only", status: "supported" },
        { id: "c2", type: "eligibility", text: "Minimum CGPA 3.0 required", status: "supported" },
      ],
    });

    expect(result.intent).toBe("ELIGIBILITY");
    const joined = result.answer.join(" ");
    expect(joined).toContain("The blockers are:");
    expect(joined).toContain("Still unconfirmed: gpa");
    // The failed hard gate is stated as requirement vs. real profile fact.
    expect(joined).toContain("your profile country is Pakistan");
    expect(result.studentMatch?.result).toBe("NOT_ELIGIBLE");
  });

  it("still refuses a percentage when the only comparable fact is a deadline", () => {
    const result = derive("Can I apply for this, and am I eligible?", {
      claims: [
        {
          id: "cd1",
          type: "deadline",
          text: "Applications are open until 6 October 2026, at 11:00 (UTC).",
          status: "supported",
        },
      ],
    });

    expect(result.intent).toBe("ELIGIBILITY");
    expect(result.studentMatch?.result).toBe("INSUFFICIENT_DATA");
    expect(result.studentMatch?.matchScore).toBeNull();
    // The question still moves the match block to the top of the page.
    expect(result.emphasis[0]).toBe("match");
  });

  it("never invents a comparison for a user without a profile", () => {
    const result = derive("Am I eligible?", { profile: null });
    expect(result.studentMatch).toBeNull();
    expect(result.answer.join(" ")).toContain("could not compare this against a student profile");
  });
});

/* ─── 7. Public portfolio evidence is echoed, not merged (spec 04/05) ─────── */

describe("public portfolio facts in the payload", () => {
  it("passes the evidence snapshot through untouched and keeps its note", () => {
    const evidence = {
      url: "https://sara.dev",
      domain: "sara.dev",
      status: "AVAILABLE" as const,
      reason: null,
      fetchedAt: "2026-08-31T00:00:00Z",
      skills: ["python"],
      fields: ["computer science"],
      educationLines: [],
      projectLines: ["Built a scholarship tracker app."],
      certificationLines: [],
      experienceYears: null,
      note: "Read from the public page you linked.",
    };
    const result = derive("Am I eligible?", { publicProfile: evidence });
    expect(result.publicProfile).toEqual(evidence);
    // The page's own project line is never presented as a profile fact.
    expect(result.studentMatch?.matched.some((check) => check.detail.includes("tracker app"))).toBe(
      false,
    );
  });

  it("is null when the student saved no portfolio link", () => {
    expect(derive("Am I eligible?").publicProfile).toBeNull();
  });
});
