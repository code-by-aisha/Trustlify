/**
 * Trustlify Backend — Tavily Search Provider
 *
 * Phase 3B: implements SearchProvider.search() with a real Tavily Search API
 * request. Connectivity smoke test only — not yet wired into the investigation
 * pipeline (Phase 4).
 *
 * Environment variables:
 *   TAVILY_API_KEY — required at call time (never logged, never sent to frontend)
 *
 * Security:
 *   - API key is sent via the Authorization: Bearer header (never in the URL)
 *   - Error messages are scrubbed of the API key before surfacing
 *   - Returned titles/snippets are untrusted data: stored as strings only,
 *     never evaluated, and result URLs are never fetched during search
 *   - No retries, no fallback providers — exactly one request per call
 */

import { z } from "zod";
import { env } from "../config/env.js";
import { SearchError } from "./errors.js";
import { searchResponseSchema } from "./SearchProvider.js";
import type {
  SearchProvider,
  SearchInput,
  SearchOutput,
} from "./SearchProvider.js";

const DEFAULT_TAVILY_BASE_URL = "https://api.tavily.com";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESULTS_CAP = 10;

/* ─── Input validation ────────────────────────────────────────────────── */

const searchInputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().positive().optional(),
});

/* ─── Raw Tavily response shape (defensive parse before normalization) ────── */

const tavilyResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
});

const tavilyResponseSchema = z.object({
  query: z.string(),
  results: z.array(tavilyResultSchema),
});

/* ─── Helpers (pure, exported for testing) ────────────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Extract the safe, truncated error message from a Tavily error response body.
 */
export function extractApiErrorMessage(body: unknown): string {
  const record = asRecord(body);
  const error = asRecord(record?.error);
  const detailRecord = asRecord(record?.detail);
  const detail = record?.detail;
  const message =
    typeof error?.message === "string"
      ? error.message
      : typeof detailRecord?.message === "string"
        ? detailRecord.message
        : typeof detail === "string"
          ? detail
          : "";
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

/**
 * Map a Tavily HTTP error status/body to a safe SearchError.
 * Never includes the API key or the full request URL.
 */
export function mapTavilyHttpError(status: number, body: unknown): SearchError {
  const apiMessage = extractApiErrorMessage(body);

  if (status === 401 || status === 403) {
    return new SearchError(
      "SEARCH_AUTH_FAILED",
      "Tavily authentication failed — check the API key",
      status,
    );
  }
  if (status === 429) {
    return new SearchError(
      "SEARCH_RATE_LIMITED",
      "Tavily rate limit exceeded — try again later",
      status,
    );
  }
  if (status >= 500) {
    return new SearchError(
      "SEARCH_PROVIDER_FAILED",
      `Tavily provider error (status ${status})${apiMessage ? `: ${apiMessage}` : ""}`,
      status,
    );
  }
  return new SearchError(
    "SEARCH_REQUEST_FAILED",
    `Tavily request failed with status ${status}${apiMessage ? `: ${apiMessage}` : ""}`,
    status,
  );
}

/**
 * Normalize and validate a raw Tavily search response body against the shared
 * SearchProvider schema. Throws SearchError("SEARCH_MALFORMED_RESPONSE") when
 * the body is non-JSON or does not match the expected shape.
 */
export function parseTavilyResponse(body: unknown): SearchOutput {
  const raw = tavilyResponseSchema.safeParse(body);
  if (!raw.success) {
    throw new SearchError(
      "SEARCH_MALFORMED_RESPONSE",
      "Tavily response failed schema validation",
      undefined,
      {
        issues: raw.error.issues.slice(0, 5).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    );
  }

  // Normalize: Tavily's "content" is the snippet. Strings are passed through
  // untouched — content is untrusted data and is never interpreted here.
  const normalized: SearchOutput = {
    query: raw.data.query,
    results: raw.data.results.map((result) => ({
      title: result.title,
      url: result.url,
      snippet: result.content,
    })),
  };

  const validated = searchResponseSchema.safeParse(normalized);
  if (!validated.success) {
    throw new SearchError(
      "SEARCH_MALFORMED_RESPONSE",
      "Normalized search response failed validation",
      undefined,
      {
        issues: validated.error.issues.slice(0, 5).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    );
  }

  return validated.data;
}

/* ─── Provider ────────────────────────────────────────────────────────────── */

export interface TavilySearchProviderConfig {
  /** Overrides env TAVILY_API_KEY (used by tests and alternate deployments). */
  apiKey?: string;
  /** Overrides the Tavily REST base URL (used by tests and proxies). */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30s. */
  timeoutMs?: number;
}

export class TavilySearchProvider implements SearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: TavilySearchProviderConfig = {}) {
    this.apiKey = config.apiKey ?? env.TAVILY_API_KEY ?? "";
    this.baseUrl = (config.baseUrl ?? DEFAULT_TAVILY_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  /**
   * Run a basic web search via the Tavily Search API.
   * Makes exactly one API request — no retries, no fallbacks, no scraping
   * of returned URLs.
   */
  async search(input: SearchInput): Promise<SearchOutput> {
    if (!this.apiKey) {
      throw new SearchError(
        "SEARCH_NOT_CONFIGURED",
        "Tavily API key is not configured — set TAVILY_API_KEY",
      );
    }

    const inputResult = searchInputSchema.safeParse(input);
    if (!inputResult.success) {
      throw new SearchError(
        "SEARCH_REQUEST_FAILED",
        "Invalid search input — query must be a non-empty string",
        400,
      );
    }

    const maxResults = Math.min(
      Math.max(1, input.maxResults ?? MAX_RESULTS_CAP),
      MAX_RESULTS_CAP,
    );

    const requestBody = {
      query: input.query,
      search_depth: "basic",
      max_results: maxResults,
    };

    const body = await this.request(requestBody);
    return parseTavilyResponse(body);
  }

  /**
   * Perform a single Tavily search request.
   * The API key travels in the Authorization header — never in the URL.
   */
  private async request(requestBody: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // Network failure or timeout — never include the URL or key in the message
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new SearchError(
        "SEARCH_NETWORK_FAILED",
        timedOut
          ? `Tavily request timed out after ${this.timeoutMs}ms`
          : "Tavily request could not be completed",
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let parsedBody: unknown = undefined;
      try {
        parsedBody = text ? JSON.parse(text) : undefined;
      } catch {
        parsedBody = undefined;
      }
      throw this.scrub(mapTavilyHttpError(response.status, parsedBody));
    }

    try {
      return await response.json();
    } catch {
      throw new SearchError(
        "SEARCH_MALFORMED_RESPONSE",
        "Tavily returned a non-JSON body",
      );
    }
  }

  /**
   * Defense-in-depth: remove any accidental occurrence of the API key
   * from an error message before it is surfaced or logged.
   */
  private scrub(error: SearchError): SearchError {
    if (!this.apiKey || !error.message.includes(this.apiKey)) {
      return error;
    }
    return new SearchError(
      error.code,
      error.message.split(this.apiKey).join("[REDACTED]"),
      error.httpStatus,
      error.details,
    );
  }
}
