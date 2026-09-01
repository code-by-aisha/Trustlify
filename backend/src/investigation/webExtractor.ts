/**
 * Trustlify Backend — Web Extractor
 *
 * Phase 4: fetches real page content for URL investigations and for selected
 * evidence sources. Lightweight HTTP + HTML parsing only — no Playwright,
 * no Selenium (spec 07).
 *
 * SSRF protection (spec 08) — every hop is validated before the request:
 *   1. URL parses and is HTTP(S)
 *   2. hostname is not a private/internal name or IP literal
 *   3. the hostname RESOLVES only to public addresses (DNS pinning check)
 *   4. redirects are followed MANUALLY — each hop re-runs the full check,
 *      so a redirect can never bypass validation
 *
 * Fetch limits (spec 09) — all configurable via env:
 *   - request timeout          (URL_FETCH_TIMEOUT_MS)
 *   - maximum response bytes   (URL_FETCH_MAX_BYTES)
 *   - supported content types  (text/html, XHTML, text/plain)
 *   - maximum extracted chars  (URL_MAX_CONTENT_CHARS) → contentTruncated
 *
 * ⚠ UNTRUSTED CONTENT BOUNDARY (spec 12): everything fetched here is inert
 * string data. It is never evaluated or executed; downstream it is stored and
 * fenced as evidence data inside the Gemini prompt.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { env } from "../config/env.js";
import {
  parseUrlInfo,
  isPrivateHostname,
  isPrivateIp,
  registrableDomain,
} from "../utils/urls.js";

/* ─── Errors ──────────────────────────────────────────────────────────────── */

export class WebFetchError extends Error {
  constructor(
    public readonly code:
      | "URL_REJECTED"
      | "PRIVATE_ADDRESS"
      | "TOO_MANY_REDIRECTS"
      | "HTTP_ERROR"
      | "UNSUPPORTED_CONTENT_TYPE"
      | "FETCH_FAILED"
      | "TIMEOUT",
    message: string,
  ) {
    super(message);
    this.name = "WebFetchError";
  }
}

/* ─── Limits ──────────────────────────────────────────────────────────────── */

export interface WebContentLimits {
  timeoutMs: number;
  maxBytes: number;
  maxContentChars: number;
  maxRedirects: number;
}

export function defaultWebContentLimits(): WebContentLimits {
  return {
    timeoutMs: env.URL_FETCH_TIMEOUT_MS,
    maxBytes: env.URL_FETCH_MAX_BYTES,
    maxContentChars: env.URL_MAX_CONTENT_CHARS,
    maxRedirects: 5,
  };
}

/* ─── Result ──────────────────────────────────────────────────────────────── */

export interface FetchedWebContent {
  originalUrl: string;
  finalUrl: string;
  originalDomain: string;
  finalDomain: string;
  domainChanged: boolean;
  title: string | null;
  /** Extracted readable text (bounded by maxContentChars). */
  text: string;
  contentTruncated: boolean;
  /** Honest publication date parsed from page metadata — null when absent. */
  publishedAt: string | null;
  contentType: string;
}

/* ─── Content type validation ─────────────────────────────────────────────── */

const ACCEPTED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

/** True when a Content-Type header names an accepted textual page type. */
export function isAcceptedContentType(contentTypeHeader: string): boolean {
  const mime = contentTypeHeader.split(";")[0]?.trim().toLowerCase() ?? "";
  return ACCEPTED_CONTENT_TYPES.includes(mime);
}

/* ─── HTML → readable text (pure, exported for testing) ───────────────────── */

/**
 * Remove elements whose entire content is noise (scripts, styles, chrome).
 */
const STRIP_BLOCK_RE =
  /<(script|style|noscript|template|svg|iframe|canvas|nav|footer|aside|form|header|button|select|option)\b[^>]*>[\s\S]*?<\/\1>/gi;

const BLOCK_CLOSE_RE =
  /<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre|table|ul|ol|dl|dd|dt|figure|figcaption)>/gi;

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      safeCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const decoded = ENTITY_MAP[name.toLowerCase()];
      return decoded ?? match;
    });
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : "";
}

export interface ExtractedText {
  text: string;
  truncated: boolean;
}

/**
 * Extract readable text from an HTML document (spec 10):
 * removes scripts/styles/navigation boilerplate, preserves titles, headings,
 * paragraphs and lists, collapses whitespace, and caps the character count.
 */
export function htmlToText(html: string, maxChars: number): ExtractedText {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleTag ? decodeEntities(titleTag[1]).replace(/\s+/g, " ").trim() : "";

  let working = html
    // comments first (may contain fake closing tags)
    .replace(/<!--[\s\S]*?-->/g, " ")
    // entire noise blocks
    .replace(STRIP_BLOCK_RE, " ")
    // list items become bullets
    .replace(/<li\b[^>]*>/gi, "\n- ")
    // block boundaries become newlines (open AND close of block elements)
    .replace(/<(p|div|section|article|li|tr|h[1-6]|blockquote|pre|table|ul|ol|dl|dd|dt|figure|figcaption)\b[^>]*>/gi, "\n")
    .replace(BLOCK_CLOSE_RE, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // every remaining tag is dropped
    .replace(/<[^>]+>/g, " ");

  working = decodeEntities(working);

  const lines = working
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0);

  let text = title ? [title, "", ...lines].join("\n") : lines.join("\n");
  // collapse 3+ blank lines (already filtered, but keep structure sane)
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  const truncated = text.length > maxChars;
  if (truncated) {
    text = text.slice(0, maxChars);
  }
  return { text, truncated };
}

/**
 * Parse an honest publication date from page metadata. Only ISO-like
 * machine-readable formats are trusted (meta tags, <time datetime>) —
 * free-text dates in prose are NOT extracted (too error-prone, and V8's
 * lenient Date parser would even accept strings like "spring 2026").
 */
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function extractPublishedDate(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["'](?:article:published_time|og:article:published_time|article:modified_time|og:updated_time)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:article:published_time|og:updated_time)["']/i,
    /<meta[^>]+name=["'](?:date|dc.date|pubdate|publish-date|citation_publication_date)["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    // Reject anything that is not ISO-like before trusting it — never let the
    // lenient Date parser invent a date from free text.
    if (!ISO_DATE_RE.test(match[1].trim())) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

/* ─── SSRF validation ─────────────────────────────────────────────────────── */

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  /** Resolves a hostname to its addresses (injectable for tests). */
  dnsLookup?: (hostname: string) => Promise<string[]>;
}

async function defaultDnsLookup(hostname: string): Promise<string[]> {
  const addresses = await dnsLookup(hostname, { all: true });
  return addresses.map((a) => a.address);
}

/**
 * Validate one URL hop: scheme, private hostname, and (when it is a name, not
 * an IP literal) that DNS resolves only to public addresses.
 * Returns the canonical URL string.
 */
export async function assertPublicUrl(
  rawUrl: string,
  dnsResolve: (hostname: string) => Promise<string[]>,
): Promise<URL> {
  const info = parseUrlInfo(rawUrl);
  if (!info) {
    throw new WebFetchError("URL_REJECTED", "URL is not a valid HTTP(S) address");
  }

  const url = new URL(rawUrl);
  if (isPrivateHostname(url.hostname)) {
    throw new WebFetchError(
      "URL_REJECTED",
      "Private, loopback, or internal network addresses are not allowed",
    );
  }

  // IP literals were checked above; names must also resolve publicly
  // (blocks DNS-based SSRF where a public name points at an internal IP).
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && !url.hostname.includes(":")) {
    let addresses: string[];
    try {
      addresses = await dnsResolve(url.hostname);
    } catch {
      throw new WebFetchError("FETCH_FAILED", "The host could not be resolved");
    }
    if (addresses.length === 0) {
      throw new WebFetchError("FETCH_FAILED", "The host could not be resolved");
    }
    const privateAddress = addresses.find((address) => isPrivateIp(address));
    if (privateAddress) {
      throw new WebFetchError(
        "PRIVATE_ADDRESS",
        "The host resolves to a private network address",
      );
    }
  }

  return url;
}

/* ─── Fetch with bounded body ─────────────────────────────────────────────── */

async function readBodyBounded(
  response: Response,
  maxBytes: number,
  timeoutMs: number,
): Promise<{ body: string; byteLimited: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return {
      body: text.slice(0, maxBytes),
      byteLimited: text.length > maxBytes,
    };
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let byteLimited = false;
  let body = "";

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new WebFetchError("TIMEOUT", "The page content download timed out")),
      timeoutMs,
    );
  });

  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeoutPromise]);
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        byteLimited = true;
        const usable = value.byteLength - (received - maxBytes);
        if (usable > 0) {
          body += decoder.decode(value.slice(0, usable));
        }
        break;
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return { body, byteLimited };
  } catch (error) {
    if (error instanceof WebFetchError) throw error;
    throw new WebFetchError("FETCH_FAILED", "The page content could not be read");
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    reader.cancel().catch(() => undefined);
  }
}

/* ─── Main entry point ────────────────────────────────────────────────────── */

const USER_AGENT =
  "Mozilla/5.0 (compatible; TrustlifyInvestigator/1.0; +https://trustlify.app/bot)";

/**
 * Fetch a URL safely and extract readable text content.
 * Follows redirects manually with full SSRF re-validation per hop (spec 08)
 * and records the redirect signal (spec 11): original/final URL + domains.
 */
export async function fetchWebContent(
  rawUrl: string,
  options: { limits?: Partial<WebContentLimits>; deps?: FetchDeps } = {},
): Promise<FetchedWebContent> {
  const limits = { ...defaultWebContentLimits(), ...options.limits };
  const fetchImpl = options.deps?.fetchImpl ?? fetch;
  const dnsResolve = options.deps?.dnsLookup ?? defaultDnsLookup;

  let currentUrl = await assertPublicUrl(rawUrl, dnsResolve);
  const originalUrl = currentUrl.toString();
  const originalDomain = registrableDomain(currentUrl.hostname);

  let response: Response | null = null;
  for (let hop = 0; hop <= limits.maxRedirects; hop += 1) {
    let next: Response;
    try {
      next = await fetchImpl(currentUrl.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(limits.timeoutMs),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      throw new WebFetchError(
        timedOut ? "TIMEOUT" : "FETCH_FAILED",
        timedOut
          ? `The page fetch timed out after ${limits.timeoutMs}ms`
          : "The page could not be fetched",
      );
    }

    const status = next.status;
    if (status >= 300 && status < 400) {
      const location = next.headers.get("location");
      if (!location) {
        throw new WebFetchError("HTTP_ERROR", `Redirect (${status}) without a target`);
      }
      if (hop === limits.maxRedirects) {
        throw new WebFetchError(
          "TOO_MANY_REDIRECTS",
          `The page redirected more than ${limits.maxRedirects} times`,
        );
      }
      // Resolve relative redirects, then re-validate the hop fully (spec 08)
      const resolved = new URL(location, currentUrl);
      currentUrl = await assertPublicUrl(resolved.toString(), dnsResolve);
      continue;
    }

    response = next;
    break;
  }

  if (!response) {
    throw new WebFetchError("TOO_MANY_REDIRECTS", "The page redirected too many times");
  }

  if (!response.ok) {
    throw new WebFetchError(
      "HTTP_ERROR",
      `The page responded with status ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!isAcceptedContentType(contentType)) {
    throw new WebFetchError(
      "UNSUPPORTED_CONTENT_TYPE",
      "The page is not an HTML or text document",
    );
  }

  const { body, byteLimited } = await readBodyBounded(
    response,
    limits.maxBytes,
    limits.timeoutMs,
  );
  const extracted = htmlToText(body, limits.maxContentChars);
  const finalUrl = currentUrl.toString();
  const finalDomain = registrableDomain(currentUrl.hostname);

  return {
    originalUrl,
    finalUrl,
    originalDomain,
    finalDomain,
    domainChanged: originalDomain !== finalDomain,
    title: extractTitle(body),
    text: extracted.text,
    contentTruncated: byteLimited || extracted.truncated,
    publishedAt: extractPublishedDate(body),
    contentType: contentType.split(";")[0]?.trim().toLowerCase() || "unknown",
  };
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return title.length > 0 ? title.slice(0, 300) : null;
}
