/**
 * Trustlify — Similar-opportunity discovery focused tests (update spec 12–15, 26)
 *
 * A fake SearchProvider is injected everywhere, so no Tavily (or any other)
 * network call can happen. These tests pin the cost ceiling, the deterministic
 * filtering, and the rule that a recommendation never claims more than the
 * listing's own text supports.
 */

import { describe, it, expect } from "vitest";
import {
  MAX_RECOMMENDATIONS,
  MAX_SEARCHES,
  buildDiscoveryQueries,
  educationLevelLabel,
  findSimilarOpportunities,
  opportunityKindOf,
  type SimilarOpportunityContext,
} from "../services/similarOpportunityService.js";
import type { SearchProvider, SearchResultItem } from "../search/SearchProvider.js";
import type { StudentProfileFacts } from "../engines/studentMatcher.js";

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
  language: "English",
};

function context(
  overrides: Partial<StudentProfileFacts> | null = null,
): SimilarOpportunityContext {
  return {
    profile: overrides === null ? STUDENT : { ...STUDENT, ...overrides },
    claims: [{ id: "c1", type: "eligibility", text: "Open to Pakistani students only" }],
    submittedUrl: "https://www.chevening.org/scholarship/pakistan",
    submittedDomain: "chevening.org",
    knownDomains: ["chevening.org", "bbc.com"],
    now: NOW,
  };
}

/** Provider double: records the queries it was asked and returns fixed rows. */
function fakeSearch(
  results: SearchResultItem[] | ((query: string, call: number) => SearchResultItem[]),
): SearchProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async search(input) {
      calls.push(input.query);
      const rows =
        typeof results === "function" ? results(input.query, calls.length) : results;
      return { query: input.query, results: rows };
    },
  };
}

const item = (title: string, url: string, snippet: string): SearchResultItem => ({
  title,
  url,
  snippet,
});

const RELEVANT = item(
  "HEC Pakistan Undergraduate Scholarship 2027",
  "https://www.hec.gov.pk/scholarships/undergraduate-2027",
  "Applications are open to Pakistani students in computer science. Deadline: 30 September 2026. Full tuition is covered.",
);

/* ─── 1. Query building — deterministic, from real fields only ────────────── */

describe("discovery query building", () => {
  it("uses the structured country, field, level and skills", () => {
    const { queries, terms } = buildDiscoveryQueries(context());

    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe(
      "scholarship Computer Science for Pakistan students undergraduate 2026",
    );
    expect(queries[1]).toContain("python");
    expect(queries[1]).toContain("research");
    expect(queries[1]).toContain("2027");
    expect(terms).toContain("Pakistan");
    // No invented geography: the query carries what the profile actually says.
    expect(queries.join(" ")).not.toMatch(/london|oxford|harvard/i);
  });

  it("falls back to free-text location and interests when the new columns are empty", () => {
    const { queries } = buildDiscoveryQueries(
      context({ country: null, fieldOfStudy: null, educationLevel: null }),
    );
    // "Islamabad, Pakistan" still names the country; the degree names the field.
    expect(queries[0]).toContain("Pakistan");
    expect(queries[0]).toContain("computer science");
  });

  it("never emits more queries than the search ceiling", () => {
    const { queries } = buildDiscoveryQueries(
      context({ skills: ["Python", "Research", "Excel", "SQL", "Figma"] }),
    );
    expect(queries.length).toBeLessThanOrEqual(MAX_SEARCHES);
  });

  it("names the opportunity kind the investigated content actually describes", () => {
    expect(opportunityKindOf([{ id: "c1", type: "funding", text: "The fellowship covers tuition" }])).toBe(
      "fellowship",
    );
    expect(opportunityKindOf([{ id: "c1", type: "funding", text: "An internship at the lab" }])).toBe(
      "internship",
    );
    // Nothing recognisable → the generic default, never a guess about the page.
    expect(opportunityKindOf([{ id: "c1", type: "other", text: "The organiser was founded in 1998" }])).toBe(
      "scholarship",
    );
    expect(educationLevelLabel(STUDENT)).toBe("Undergraduate (Bachelor's level)");
    expect(educationLevelLabel(null)).toBeNull();
  });
});

/* ─── 2. Relevant results ─────────────────────────────────────────────────── */

describe("relevant recommendations", () => {
  it("keeps a genuinely matching listing and every reason names a real signal", async () => {
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([RELEVANT]),
    });

    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card.title).toBe("HEC Pakistan Undergraduate Scholarship 2027");
    expect(card.domain).toBe("hec.gov.pk");
    expect(card.sourceType).toBe("government");
    expect(card.why.join(" ")).toContain("Lists a scholarship");
    expect(card.why.join(" ")).toContain("Names Pakistan, the country on your profile");
    expect(card.why.join(" ")).toContain("In your field: computer science");
    expect(card.why.join(" ")).toContain("GOVERNMENT-classified domain");
    // The deadline is read from the listing's own sentence.
    expect(card.deadlineIso).toBe("2026-09-30");
    expect(card.deadlineDetail).toMatch(/30 Sep/);
    expect(result.filteredOut).toBe(0);
  });

  it("derives a match note only from that listing's own text", async () => {
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([RELEVANT]),
    });
    const card = result.items[0];

    expect(card.match?.basis).toBe("search snippet");
    for (const check of card.match?.checks ?? []) {
      const source = check.source.replace(/…$/, "");
      expect(`${RELEVANT.title} ${RELEVANT.snippet}`).toContain(source);
    }
    // The note itself is honest about what these are.
    expect(result.note).toContain("search leads, not verified opportunities");
  });

  it("ranks a listing the student fails below one they qualify for", async () => {
    // The same kind of listing, but this student is 30 and the cap is 25.
    const ageLimited = item(
      "HEC Merit Scholarship 2027 for Pakistan",
      "https://www.hec.gov.pk/scholarships/merit-2027",
      "Open to Pakistani students in computer science. Applicants must be under 25 years old.",
    );
    const result = await findSimilarOpportunities(context({ age: 30 }), {
      search: fakeSearch([ageLimited, RELEVANT]),
    });

    expect(result.items).toHaveLength(2);
    // The listing whose own text rules the student out is last, and says so.
    expect(result.items[1].domain).toBe("hec.gov.pk");
    expect(result.items[1].url).toBe(ageLimited.url);
    expect(result.items[1].match?.result).toBe("NOT_ELIGIBLE");
    expect(result.items[0].match?.result).toBe("ELIGIBLE");
    // No reason line ever claims the student is eligible.
    for (const card of result.items) {
      expect(card.why.join(" ")).not.toMatch(/eligible/i);
    }
  });

  it("prefers a matching listing over one that merely scores high", async () => {
    const strong = item(
      "Lahore Tech Undergraduate Scholarship — Pakistan",
      "https://lums.edu.pk/scholarships/undergraduate",
      "For Pakistani students in computer science. Apply by 1 December 2026.",
    );
    const weaker = item(
      "National Pakistan Scholarship 2027",
      "https://www.hec.gov.pk/scholarships/national-2027",
      "Open to Pakistani applicants. The award amount varies by programme.",
    );
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([weaker, strong]),
    });

    // Both qualify, but the one with more comparable requirements comes first.
    expect(result.items[0].domain).toBe("lums.edu.pk");
    expect(result.items[0].sourceType).toBe("academic");
  });
});

/* ─── 3. Irrelevant, foreign and duplicate results are dropped ────────────── */

describe("filtering", () => {
  it("drops results that share no signal with the profile or the content", async () => {
    const provider = fakeSearch([
      item(
        "Weekend baking ideas for busy families",
        "https://recipes.example/cakes",
        "Simple recipes and cake tips for beginners, with a short video guide for home cooks everywhere.",
      ),
      RELEVANT,
    ]);
    const result = await findSimilarOpportunities(context(), { search: provider });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe(RELEVANT.url);
    expect(result.filteredOut).toBe(1);
  });

  it("drops a listing aimed at another country's students instead of padding the list", async () => {
    const foreign = item(
      "São Paulo City Scholarship for Undergraduates",
      "https://prefeitura.sp.gov.br/bolsas",
      "Open only to students in Brazil studying computer science. Deadline: 15 January 2027.",
    );
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([foreign, RELEVANT]),
    });

    expect(result.items.map((card) => card.domain)).toEqual(["hec.gov.pk"]);
    expect(result.filteredOut).toBe(1);
  });

  it("never recommends the page the student already investigated, and dedupes", async () => {
    const provider = fakeSearch((query, call) => {
      const shared = item(
        "HEC Pakistan Undergraduate Scholarship 2027",
        "https://www.hec.gov.pk/scholarships/undergraduate-2027/",
        "Applications are open to Pakistani students in computer science. Deadline: 30 September 2026. Full tuition is covered.",
      );
      return call === 1
        ? [
            shared,
            item(
              "Chevening Pakistan Scholarship",
              "https://www.chevening.org/scholarship/pakistan/",
              "Open to Pakistani students. Applications open in August every year.",
            ),
          ]
        : [shared];
    });

    const result = await findSimilarOpportunities(context(), { search: provider });

    expect(result.items.map((card) => card.url)).toEqual([
      "https://www.hec.gov.pk/scholarships/undergraduate-2027/",
    ]);
    // The submitted page is gone even though its snippet was a perfect match.
    expect(result.note).toContain("search leads");
    expect(provider.calls).toHaveLength(MAX_SEARCHES);
  });

  it("caps the list at three cards however many results qualify", async () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      item(
        `Pakistan Computer Science Scholarship Round ${index + 1}`,
        `https://scholarships${index + 1}.example.org/pk`,
        "Open to Pakistani students in computer science. Apply before the closing date on the page.",
      ),
    );
    const result = await findSimilarOpportunities(context(), { search: fakeSearch(many) });

    expect(result.items.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
    expect(result.items).toHaveLength(MAX_RECOMMENDATIONS);
  });

  it("demotes a domain this investigation already used rather than hiding it", async () => {
    // Identical listing text, so only the already-seen domain can differ.
    const snippet = "For Pakistani students in computer science. Apply by 1 December 2026.";
    const alreadyKnown = item(
      "BBC Pakistan Scholarship Guide",
      "https://bbc.com/pakistan-scholarship-guide",
      snippet,
    );
    const fresh = item(
      "Weekly Pakistan Scholarship Guide",
      "https://newsweekly.example/pakistan-scholarship-guide",
      snippet,
    );
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([alreadyKnown, fresh]),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].domain).toBe("newsweekly.example");
    expect(result.items[1].domain).toBe("bbc.com");
  });
});

/* ─── 4. Cost ceiling and the honest empty answer ─────────────────────────── */

describe("cost ceiling and empty results", () => {
  it("runs at most two searches, always through the injected provider", async () => {
    let calls = 0;
    const provider: SearchProvider = {
      async search(input) {
        calls += 1;
        return { query: input.query, results: [] };
      },
    };

    const result = await findSimilarOpportunities(context(), { search: provider });
    expect(result.searchesRun).toBeLessThanOrEqual(MAX_SEARCHES);
    expect(result.searchesRun).toBe(2);
    expect(calls).toBe(2);
    // Every query sent is one this module built, word for word.
    expect(result.queries).toHaveLength(result.searchesRun);
  });

  it("reports an empty result as 'no strong matching opportunities' — never a filler card", async () => {
    const result = await findSimilarOpportunities(context(), { search: fakeSearch([]) });

    expect(result.items).toEqual([]);
    expect(result.note).toBe("No strong matching opportunities were found.");
  });

  it("says the same when results existed but every one was filtered out", async () => {
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([
        item(
          "Weekend baking ideas for busy families",
          "https://recipes.example/cakes",
          "Simple recipes and cake tips for beginners, with a short video guide for home cooks.",
        ),
      ]),
    });

    expect(result.items).toEqual([]);
    expect(result.filteredOut).toBe(1);
    expect(result.note).toBe("No strong matching opportunities were found.");
  });

  it("keeps the relevance floor above a single weak overlap", async () => {
    // One signal only (the kind word) — far below the score a real overlap needs.
    const weak = item(
      "Our Foundation Awards Night",
      "https://foundation.example/awards",
      "An awards ceremony for donors and friends of the foundation this spring.",
    );
    const result = await findSimilarOpportunities(context(), { search: fakeSearch([weak]) });
    expect(result.items).toEqual([]);
    expect(result.filteredOut).toBe(1);
  });
});

/* ─── 5. Trust is never inherited from a search ranking ───────────────────── */

describe("prior verdicts", () => {
  it("attaches a verdict only when Trustlify already stored one for that URL", async () => {
    const other = item(
      "Lahore Tech Undergraduate Scholarship — Pakistan",
      "https://lums.edu.pk/scholarships/undergraduate",
      "For Pakistani students in computer science. Apply by 1 December 2026.",
    );
    let asked: string[] = [];

    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([RELEVANT, other]),
      priorVerdicts: async (urls) => {
        asked = urls;
        return new Map([[RELEVANT.url, "VERIFIED · trust 82/100 — investigated earlier by you"]]);
      },
    });

    expect(asked.sort()).toEqual([RELEVANT.url, other.url].sort());
    expect(result.items.find((card) => card.url === RELEVANT.url)?.priorVerdict).toBe(
      "VERIFIED · trust 82/100 — investigated earlier by you",
    );
    expect(result.items.find((card) => card.url === other.url)?.priorVerdict).toBeNull();
    // The ranking itself never claims trustworthiness.
    expect(result.note).not.toMatch(/trustworthy/i);
  });

  it("does not query stored verdicts when there is nothing to show", async () => {
    let called = false;
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([]),
      priorVerdicts: async () => {
        called = true;
        return new Map();
      },
    });
    expect(result.items).toEqual([]);
    expect(called).toBe(false);
  });
});

/* ─── 6. Role gating inside discovery (the route guards it, too) ──────────── */

describe("non-student requests", () => {
  it("lists leads but claims no fit without a student profile comparison", async () => {
    const result = await findSimilarOpportunities(context({ role: "general" }), {
      search: fakeSearch([RELEVANT]),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].match).toBeNull();
    // Filtering still uses the stored fields — the listing is still relevant.
    expect(result.items[0].why.join(" ")).toContain("Names Pakistan");
  });

  it("still works with no profile at all, and states no eligibility", async () => {
    const ctx: SimilarOpportunityContext = {
      profile: null,
      claims: [{ id: "c1", type: "eligibility", text: "Open to Pakistani students only" }],
      submittedUrl: null,
      submittedDomain: null,
      now: NOW,
    };
    const result = await findSimilarOpportunities(ctx, { search: fakeSearch([RELEVANT]) });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].match).toBeNull();
    expect(JSON.stringify(result.items)).not.toMatch(/"result"/);
  });
});

/* ─── 7. A listing headline is a relevance signal, not a requirement ──────── */

describe("snippets that state no requirements", () => {
  /** Verbatim shape of the aggregator page a live recommendation run returned. */
  const LISTING = item(
    "74 Scholarships for Computer Science & IT in Pakistan | Mastersportal",
    "https://www.mastersportal.com/scholarships/pakistan/computer-science",
    "Browse 74 scholarships for Computer Science & IT in Pakistan. Compare tuition fees, living costs and application documents.",
  );

  it("refuses ELIGIBLE and a percentage for a page that lists rather than requires", async () => {
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([LISTING]),
    });

    // Still a legitimate lead — the filtering signals are genuinely present.
    expect(result.items).toHaveLength(1);
    const card = result.items[0];
    expect(card.why.join(" ")).toContain("Names Pakistan");
    expect(card.why.join(" ")).toContain("In your field: computer science");

    // …but naming a country and a field is not stating a requirement, so the
    // matcher has nothing comparable and must say so instead of scoring (spec 09/10/13).
    expect(card.match?.result).toBe("INSUFFICIENT_DATA");
    expect(card.match?.matchScore).toBeNull();
    expect(card.match?.checks).toHaveLength(0);
    expect(JSON.stringify(card)).not.toMatch(/"result":"ELIGIBLE"/);
  });

  it("still reports a real match when the snippet itself uses requirement phrasing", async () => {
    const result = await findSimilarOpportunities(context(), {
      search: fakeSearch([RELEVANT]),
    });

    const match = result.items[0].match;
    expect(match?.result).toBe("ELIGIBLE");
    expect(match?.matchScore).not.toBeNull();
    // The difference is the snippet's own wording, not a hard-coded domain list.
    expect(match?.checks.map((check) => check.kind)).toContain("country");
  });
});
