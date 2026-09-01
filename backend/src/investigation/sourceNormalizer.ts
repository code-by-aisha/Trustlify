/**
 * Trustlify Backend — Source Normalizer
 *
 * Phase 3C: normalizes search provider results into Trustlify source objects.
 *
 * ⚠ UNTRUSTED WEB CONTENT BOUNDARY (spec 12)
 * Everything returned by a search provider — titles, snippets, URLs — is
 * UNTRUSTED DATA. It enters the pipeline here as plain strings only. It is
 * never evaluated, never executed, never allowed to alter system prompts,
 * developer instructions, application configuration, or API behavior, and
 * result URLs are never fetched during this phase.
 *
 * Classification (spec 11) is deliberately conservative:
 *   - Only deterministic, defensible hostname heuristics are used
 *   - A source is NEVER classified from keywords like "official" in its title
 *   - When uncertain → UNKNOWN (the future Trust Engine assigns authority)
 *
 * No hallucination (spec 10): publisher, publication date, and verification
 * status are never invented — unknown stays unknown.
 */

import { z } from "zod";
import type { ClaimType } from "../types/investigation.js";

/* ─── Normalized source model ─────────────────────────────────────────────── */

/**
 * Conservative source classification. Mirrors the existing SourceType domain
 * taxonomy; 'social' and 'unknown' are the Phase 3C additions.
 */
export const classifiedSourceTypeSchema = z.enum([
  "government",
  "academic",
  "news",
  "social",
  "community",
  "unknown",
]);

export type ClassifiedSourceType = z.infer<typeof classifiedSourceTypeSchema>;

export interface NormalizedSource {
  title: string;
  url: string;
  domain: string;
  /** Untrusted snippet text — stored verbatim, never interpreted. */
  snippet: string;
  sourceType: ClassifiedSourceType;
  /** ISO timestamp of retrieval. */
  retrievedAt: string;
}

export const normalizedSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  snippet: z.string(),
  sourceType: classifiedSourceTypeSchema,
  retrievedAt: z.string().datetime(),
});

/* ─── Hostname heuristics (deterministic only) ────────────────────────────── */

/**
 * Deterministic social platforms. Exact host match only — no keyword guessing.
 */
const SOCIAL_HOSTS = new Set([
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "reddit.com",
  "tiktok.com",
  "t.me",
  "whatsapp.com",
  "threads.net",
  "pinterest.com",
]);

function domainSegments(hostname: string): string[] {
  return hostname.toLowerCase().split(".").filter(Boolean);
}

/**
 * Conservatively classify a hostname into a source type.
 *
 * Deterministic, position-aware rules only — the gov/edu/ac signal must sit
 * in the registrable-domain portion of the hostname (the last two labels),
 * never in an arbitrary subdomain label:
 *   - host ends with '.gov' or second-to-last label is 'gov' (hec.gov.pk,
 *     gov.uk)                                              → government
 *   - host ends with '.edu' or second-to-last label is 'edu'/'ac'
 *     (lums.edu.pk, ox.ac.uk, mit.edu)                     → academic
 *   - exact-match social platform host                      → social
 *   - everything else                                       → unknown
 *
 * News/institution/community classification is NOT attempted: there is no
 * defensible deterministic signal in a bare hostname, so those fall back to
 * UNKNOWN until the Trust Engine can assess them with real signals.
 */
export function classifySourceType(url: string): ClassifiedSourceType {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }

  // Strip a leading "www." for exact-match tests.
  const bare = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  if (SOCIAL_HOSTS.has(bare) || SOCIAL_HOSTS.has(hostname)) {
    return "social";
  }

  const segments = domainSegments(hostname);
  const last = segments[segments.length - 1];
  const secondToLast = segments.length >= 2 ? segments[segments.length - 2] : undefined;

  if (last === "gov" || secondToLast === "gov") return "government";
  if (last === "edu" || secondToLast === "edu" || secondToLast === "ac") {
    return "academic";
  }

  return "unknown";
}

/* ─── Normalization ───────────────────────────────────────────────────────── */

export interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Normalize raw search results into Trustlify source objects.
 * Empty result lists are valid — a search can legitimately return nothing.
 *
 * Every field is passed through as inert string data. Titles/snippets are
 * truncated to sane bounds for storage, never interpreted.
 */
export function normalizeSearchSources(
  results: RawSearchResult[],
  now: Date = new Date(),
): NormalizedSource[] {
  const retrievedAt = now.toISOString();

  return results.map((result) => {
    let domain = result.url;
    try {
      const hostname = new URL(result.url).hostname.toLowerCase();
      // Canonicalize away a leading "www." so stored domains are stable
      // (www.hec.gov.pk and hec.gov.pk are the same publisher).
      domain =
        hostname.startsWith("www.") && hostname.slice(4).includes(".")
          ? hostname.slice(4)
          : hostname;
    } catch {
      // URL was already validated upstream by the search response schema;
      // keep the raw string defensively if parsing fails.
    }

    return {
      title: result.title.slice(0, 300),
      url: result.url,
      domain,
      snippet: result.snippet.slice(0, 1000),
      sourceType: classifySourceType(result.url),
      retrievedAt,
    };
  });
}

/* ─── Dedupe + selection (spec 16/18/19) ─────────────────────────────────── */

/**
 * Canonical URL key for equivalence: scheme-insensitive host (www stripped),
 * path (trailing slash normalized), and query string. Hash fragments never
 * affect page content. Equivalent URLs count as ONE source — duplicates are
 * never treated as independent evidence.
 */
export function canonicalUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const query = parsed.search;
    return `${host}${path}${query}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Remove duplicate sources: same canonical URL (first occurrence wins),
 * keeping the original order for determinism.
 */
export function dedupeSources(sources: NormalizedSource[]): NormalizedSource[] {
  const seen = new Set<string>();
  const result: NormalizedSource[] = [];
  for (const source of sources) {
    const key = canonicalUrlKey(source.url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

/**
 * Deterministic selection priority for source content fetching (spec 18/19):
 *   1. authoritative hostname signals (government/academic)
 *   2. unique domains (independent sources beat repeats)
 *   3. non-social pages (social platforms rarely fetch well and are weak evidence)
 *   4. longer snippets (more apparent content)
 *   5. original search order (stable tie-breaker)
 *
 * Selection NEVER infers official status from titles or snippets — only the
 * defensible hostname classification from classifySourceType is used.
 */
export function selectSourcesForFetch(
  sources: NormalizedSource[],
  maxFetches: number,
): NormalizedSource[] {
  const scored = sources.map((source, index) => {
    let score = 0;
    if (source.sourceType === "government" || source.sourceType === "academic") {
      score += 100;
    }
    if (source.sourceType === "social") {
      score -= 40;
    }
    score += Math.min(source.snippet.length, 600) / 100;
    return { source, score, index };
  });

  const sorted = [...scored].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.index - b.index;
  });

  const selected: NormalizedSource[] = [];
  const selectedDomains = new Set<string>();
  for (const entry of sorted) {
    if (selected.length >= maxFetches) break;
    // Prefer spreading across distinct domains: skip a duplicate-domain source
    // while unexplored domains remain among the candidates.
    if (selectedDomains.has(entry.source.domain)) {
      const unexplored = sorted.some(
        (other) => !selectedDomains.has(other.source.domain),
      );
      if (unexplored) continue;
    }
    selectedDomains.add(entry.source.domain);
    selected.push(entry.source);
  }

  // Restore a stable, deterministic output order (original search order)
  return selected.sort((a, b) => sources.indexOf(a) - sources.indexOf(b));
}

/* ─── Claim type helper for source labels (display only) ──────────────────── */

export function claimTypeLabel(type: ClaimType): string {
  return type.replace(/_/g, " ").toUpperCase();
}
