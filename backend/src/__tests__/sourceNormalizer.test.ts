/**
 * Trustlify Backend — Source Normalizer Tests (Phase 3C)
 *
 * Spec section 26, categories:
 *   8.  valid Tavily source normalization
 *   14. source classification fallback to UNKNOWN
 *
 * Fixture-based only — no network calls. Snippets are untrusted data and are
 * asserted to pass through as inert strings.
 */

import { describe, it, expect } from "vitest";
import {
  classifySourceType,
  normalizeSearchSources,
  normalizedSourceSchema,
  canonicalUrlKey,
  dedupeSources,
  selectSourcesForFetch,
  type NormalizedSource,
} from "../investigation/sourceNormalizer.js";

const NOW = new Date("2026-08-30T10:00:00.000Z");

/* ─── 8. Valid Tavily source normalization ────────────────────────────────── */

describe("category 8 — valid Tavily source normalization", () => {
  it("normalizes valid search results into Trustlify source objects", () => {
    const results = [
      {
        title: "HEC Overseas Scholarships",
        url: "https://hec.gov.pk/scholarships",
        snippet: "The Higher Education Commission offers fully funded scholarships.",
      },
      {
        title: "University Scholarship Page",
        url: "https://www.lums.edu.pk/scholarships",
        snippet: "Financial aid and scholarship opportunities for students.",
      },
    ];

    const sources = normalizeSearchSources(results, NOW);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({
      title: "HEC Overseas Scholarships",
      url: "https://hec.gov.pk/scholarships",
      domain: "hec.gov.pk",
      snippet: "The Higher Education Commission offers fully funded scholarships.",
      sourceType: "government",
      retrievedAt: NOW.toISOString(),
    });
    expect(sources[1].domain).toBe("lums.edu.pk");
    expect(sources[1].sourceType).toBe("academic");
  });

  it("always outputs rows that pass the normalizedSourceSchema", () => {
    const sources = normalizeSearchSources(
      [
        { title: "A", url: "https://a.example.com/x", snippet: "s" },
        { title: "B", url: "https://b.example.com/y", snippet: "" },
      ],
      NOW,
    );
    for (const source of sources) {
      expect(normalizedSourceSchema.safeParse(source).success).toBe(true);
    }
  });

  it("truncates oversized titles and snippets to storage bounds", () => {
    const sources = normalizeSearchSources(
      [
        {
          title: "T".repeat(500),
          url: "https://example.com/page",
          snippet: "S".repeat(2000),
        },
      ],
      NOW,
    );
    expect(sources[0].title.length).toBe(300);
    expect(sources[0].snippet.length).toBe(1000);
  });

  it("normalizes an empty result list to an empty source list", () => {
    expect(normalizeSearchSources([], NOW)).toEqual([]);
  });

  it("never invents publisher or publication date fields", () => {
    const sources = normalizeSearchSources(
      [{ title: "A", url: "https://example.com/a", snippet: "s" }],
      NOW,
    );
    const record = sources[0] as Record<string, unknown>;
    expect("publisher" in record).toBe(false);
    expect("publishedAt" in record).toBe(false);
  });
});

/* ─── Classification heuristics (deterministic hostname signals only) ─────── */

describe("source classification heuristics", () => {
  it("classifies government domains", () => {
    expect(classifySourceType("https://hec.gov.pk/scholarships")).toBe("government");
    expect(classifySourceType("https://www.gov.uk/grants")).toBe("government");
  });

  it("classifies academic domains (edu/ac segments)", () => {
    expect(classifySourceType("https://lums.edu.pk/aid")).toBe("academic");
    expect(classifySourceType("https://www.ox.ac.uk/admissions")).toBe("academic");
    expect(classifySourceType("https://mit.edu")).toBe("academic");
  });

  it("classifies exact-match social platform hosts", () => {
    expect(classifySourceType("https://facebook.com/groups/scholarships")).toBe("social");
    expect(classifySourceType("https://www.instagram.com/p/abc123")).toBe("social");
    expect(classifySourceType("https://x.com/user/status/1")).toBe("social");
    expect(classifySourceType("https://t.me/scholarshipchannel")).toBe("social");
  });

  it("returns unknown for an unparseable URL", () => {
    expect(classifySourceType("not-a-url")).toBe("unknown");
  });
});

/* ─── 14. Source classification fallback to UNKNOWN ────────────────────────── */

describe("category 14 — source classification fallback to UNKNOWN", () => {
  it("falls back to unknown for ordinary domains with no deterministic signal", () => {
    for (const url of [
      "https://apply-scholarship.com/fund2025",
      "https://www.scholarships.pk/opportunities",
      "https://medium.com/@writer/scholarship-guide",
      "https://blog.example.org/news",
    ]) {
      expect(classifySourceType(url)).toBe("unknown");
    }
  });

  it("NEVER classifies from keywords like 'official' in the title", () => {
    // The word "official" in a title or URL path must not make a source official
    const sources = normalizeSearchSources(
      [
        {
          title: "Official Scholarship Portal — Apply Now",
          url: "https://apply-scholarship.com/official",
          snippet: "The official page for the official scholarship.",
        },
      ],
      NOW,
    );
    expect(sources[0].sourceType).toBe("unknown");
  });

  it("does not classify a lookalike domain as government/academic", () => {
    // 'gov' as part of a word, not a domain segment
    expect(classifySourceType("https://govrelations.example.com/")).toBe("unknown");
    expect(classifySourceType("https://scholarship-guides.edu.example.com/")).toBe("unknown");
  });
});

/* ─── Dedupe (spec 16/18) ───────────────────────────────────────────────── */

function src(
  url: string,
  overrides: Partial<NormalizedSource> = {},
): NormalizedSource {
  let domain = url;
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return {
    title: "Page",
    url,
    domain,
    snippet: "A snippet.",
    sourceType: "unknown",
    retrievedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("canonicalUrlKey", () => {
  it("treats scheme, www, and trailing slash as equivalent", () => {
    expect(canonicalUrlKey("https://example.com/a")).toBe("example.com/a");
    expect(canonicalUrlKey("http://www.example.com/a")).toBe("example.com/a");
    expect(canonicalUrlKey("https://example.com/a/")).toBe("example.com/a");
    expect(canonicalUrlKey("https://EXAMPLE.com/a")).toBe("example.com/a");
  });

  it("ignores hash fragments but keeps distinct query strings", () => {
    expect(canonicalUrlKey("https://example.com/a#section")).toBe(
      canonicalUrlKey("https://example.com/a"),
    );
    expect(canonicalUrlKey("https://example.com/a?x=1")).not.toBe(
      canonicalUrlKey("https://example.com/a?x=2"),
    );
  });

  it("falls back to the lowercased raw string for unparseable input", () => {
    expect(canonicalUrlKey("Not A URL")).toBe("not a url");
  });
});

describe("dedupeSources", () => {
  it("collapses equivalent URLs to the first occurrence", () => {
    const sources = [
      src("https://example.com/a", { title: "First" }),
      src("http://www.example.com/a/#top", { title: "Duplicate" }),
      src("https://example.com/a/", { title: "Also duplicate" }),
    ];

    const deduped = dedupeSources(sources);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].title).toBe("First");
  });

  it("keeps genuinely distinct URLs in their original order", () => {
    const sources = [
      src("https://b.example.org/x"),
      src("https://a.example.org/y"),
      src("https://c.example.org/z"),
    ];

    expect(dedupeSources(sources).map((s) => s.url)).toEqual([
      "https://b.example.org/x",
      "https://a.example.org/y",
      "https://c.example.org/z",
    ]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeSources([])).toEqual([]);
  });
});

/* ─── Selection for content fetching (spec 18/19) ────────────────────────── */

describe("selectSourcesForFetch", () => {
  it("returns nothing when there is nothing to select", () => {
    expect(selectSourcesForFetch([], 3)).toEqual([]);
  });

  it("prefers authoritative sources over longer snippets", () => {
    const blog = src("https://blog.example.org/long", {
      snippet: "S".repeat(600),
    });
    const gov = src("https://hec.gov.pk/scholarships", {
      sourceType: "government",
      snippet: "Short.",
    });

    const selected = selectSourcesForFetch([blog, gov], 1);

    expect(selected).toHaveLength(1);
    expect(selected[0].url).toBe("https://hec.gov.pk/scholarships");
  });

  it("penalizes social sources below ordinary pages", () => {
    const social = src("https://facebook.com/groups/scholarships", {
      sourceType: "social",
      snippet: "S".repeat(600),
    });
    const blog = src("https://blog.example.org/post", { snippet: "tiny" });

    const selected = selectSourcesForFetch([social, blog], 1);

    expect(selected[0].url).toBe("https://blog.example.org/post");
  });

  it("breaks ties with snippet length, then original order", () => {
    const short = src("https://one.example.org/a", { snippet: "x" });
    const long = src("https://two.example.org/b", { snippet: "y".repeat(400) });

    expect(selectSourcesForFetch([short, long], 1)[0].url).toBe(
      "https://two.example.org/b",
    );
    // Same length → original order wins
    const same = [
      src("https://first.example.org/a", { snippet: "12345" }),
      src("https://second.example.org/b", { snippet: "12345" }),
    ];
    expect(selectSourcesForFetch(same, 1)[0].url).toBe("https://first.example.org/a");
  });

  it("caps the selection at maxFetches", () => {
    const sources = [
      src("https://one.example.org/a"),
      src("https://two.example.org/b"),
      src("https://three.example.org/c"),
      src("https://four.example.org/d"),
      src("https://five.example.org/e"),
    ];

    expect(selectSourcesForFetch(sources, 3)).toHaveLength(3);
    expect(selectSourcesForFetch(sources, 1)).toHaveLength(1);
  });

  it("spreads selection across distinct domains while unexplored domains remain", () => {
    const govA = src("https://hec.gov.pk/a", { sourceType: "government" });
    const govB = src("https://hec.gov.pk/b", { sourceType: "government" });
    const blog = src("https://example.org/c");

    const selected = selectSourcesForFetch([govA, govB, blog], 2);

    // The second hec.gov.pk page is skipped in favour of the unexplored domain
    expect(selected.map((s) => s.url)).toEqual([
      "https://hec.gov.pk/a",
      "https://example.org/c",
    ]);
  });

  it("allows duplicate domains once no unexplored domain remains", () => {
    const govA = src("https://hec.gov.pk/a", { sourceType: "government" });
    const govB = src("https://hec.gov.pk/b", { sourceType: "government" });

    expect(selectSourcesForFetch([govA, govB], 2).map((s) => s.url)).toEqual([
      "https://hec.gov.pk/a",
      "https://hec.gov.pk/b",
    ]);
  });

  it("returns the selection in stable original search order", () => {
    const blog1 = src("https://blog-one.example.org/a");
    const gov = src("https://hec.gov.pk/official", { sourceType: "government" });
    const blog2 = src("https://blog-two.example.org/b");

    const selected = selectSourcesForFetch([blog1, gov, blog2], 2);

    // gov wins a slot on score, blog1 the other — but the output keeps the
    // original ranking order (blog1 appeared before gov in the results)
    expect(selected.map((s) => s.url)).toEqual([
      "https://blog-one.example.org/a",
      "https://hec.gov.pk/official",
    ]);
  });
});
