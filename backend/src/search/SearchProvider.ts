/**
 * Trustlify Backend — Search Provider Interface
 *
 * Defines the contract for web search operations. The application depends on
 * this interface, not on any specific search vendor SDK.
 *
 * Implementation: TavilySearchProvider (Phase 3B)
 *
 * Security:
 *   - Returned web content (titles, snippets) is UNTRUSTED data.
 *     It must never be evaluated, executed, or followed automatically.
 *   - URLs in results are data only — no scraping or fetching during search.
 */

import { z } from "zod";

export interface SearchProvider {
  /** Run a web search and return normalized results. */
  search(input: SearchInput): Promise<SearchOutput>;
}

// --- Input/Output types ---

export interface SearchInput {
  query: string;
  /** Maximum number of results to request. Provider may cap this. */
  maxResults?: number;
}

export interface SearchOutput {
  query: string;
  results: SearchResultItem[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

// --- Normalized response schema (Zod) ---

/**
 * Validates the normalized search response shape shared by all providers.
 * An empty results array is valid — searches can legitimately return nothing.
 */
export const searchResponseSchema = z.object({
  query: z.string().min(1),
  results: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().url(),
      snippet: z.string(),
    }),
  ),
});

/**
 * Extract the hostname (domain) from a result URL.
 * Returns the raw string when parsing fails — URLs are already Zod-validated
 * upstream, so this is defensive only.
 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
