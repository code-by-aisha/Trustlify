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
