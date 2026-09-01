/**
 * Trustlify Backend — Public Profile Evidence (student portfolio page)
 *
 * A student may store an optional PUBLIC portfolio / profile URL on their
 * profile (the existing `profiles.portfolio_url` column). When they do, the
 * visible text of that page is read as SUPPLEMENTARY evidence for matching
 * (update spec 04/05).
 *
 * Hard boundaries, all deliberate:
 *   - Only the existing SSRF-safe fetcher is used (`fetchWebContent`): public
 *     HTTP(S) hosts only, private/link-local addresses rejected, redirects
 *     re-checked, size and time bounded.
 *   - One plain GET. No login, no cookies, no browser automation, no bypassing
 *     of robots or access controls. A page that needs a session simply reads
 *     as unavailable — that outcome is reported, never worked around.
 *   - The fetched page is UNTRUSTED INPUT. It is scanned for known vocabulary
 *     as inert data; it is never sent to a model, never treated as an
 *     instruction, and never written back into the saved profile.
 *   - Nothing is inferred. A skill word that is not in the curated vocabulary
 *     is not a skill, and an unreadable page produces no facts at all.
 *
 * Cost: this is a plain HTTP fetch of one page the student themselves linked.
 * It uses no Gemini and no Tavily credit, and the result is cached in-process
 * so a polling client cannot make it fetch repeatedly.
 */

import { fetchWebContent, WebFetchError } from "../investigation/webExtractor.js";
import { SKILLS, disciplinesIn, mentionsToken, normalizeLookup } from "../engines/studentMatcher.js";

export type PublicProfileStatus = "AVAILABLE" | "UNAVAILABLE" | "NOT_PROVIDED";

export interface PublicProfileEvidence {
  url: string | null;
  domain: string | null;
  status: PublicProfileStatus;
  /** Honest reason when status is UNAVAILABLE — never a guessed substitute. */
  reason: string | null;
  /** ISO time of the fetch this snapshot came from (null when never fetched). */
  fetchedAt: string | null;
  skills: string[];
  fields: string[];
  /** Verbatim short lines that state a qualification, project or certificate. */
  educationLines: string[];
  projectLines: string[];
  certificationLines: string[];
  /** Only when the page states a duration, e.g. "3 years of teaching". */
  experienceYears: number | null;
  /** Always present: what this list is and is not. */
  note: string;
}

const EVIDENCE_NOTE =
  "Read from the public page you linked, at the time shown. It supplements your saved profile and never replaces it.";

/** Visible text below this is a wall, a redirect shell, or an empty page. */
const MIN_USEFUL_CHARS = 200;

/** Pages that only say "sign in" must not be mined for partial signals. */
const PROTECTED_WALL =
  /\b(?:sign in to continue|log in to (?:continue|view|access)|you must be logged in|this content is private|profile is private|403 forbidden|access denied)\b/i;

const EXPERIENCE_YEARS = /\b(\d{1,2})\s*\+?\s*years?\b[^\n]{0,24}?\b(?:experience|working|worked|internship|volunteer)/i;

function clip(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/** Sentence-ish split, tolerant of the newline-separated text the extractor emits. */
function lines(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.replace(/^[\s•·\-*]+/, "").trim())
    .filter((line) => line.length >= 12 && line.length <= 300);
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Scan visible public text for the vocabulary the matcher already understands.
 * Pure — the same page text always yields the same evidence.
 */
export function extractPublicProfileFacts(
  text: string,
  url: string,
  fetchedAt: string,
): PublicProfileEvidence {
  const lookup = normalizeLookup(text);
  const skills = SKILLS.filter((skill) => mentionsToken(lookup, skill));
  const fields = disciplinesIn(text);
  const sentences = lines(text);

  const educationLines = sentences
    .filter((line) =>
      /\b(?:matric|o[- ]?levels?|fsc|hsc|a[- ]?levels?|intermediate|bachelor|bsc|bs\b|master|msc|mphil|phd|ph\.?d|undergraduate|graduate|diploma|university|institute|college|school of)\b/i.test(
        line,
      ),
    )
    .slice(0, 3)
    .map((line) => clip(line, 160));

  const projectLines = sentences
    .filter((line) => /\b(?:project|built|developed|github\.io|portfolio|app|website|thesis|research)\b/i.test(line))
    .slice(0, 3)
    .map((line) => clip(line, 160));

  const certificationLines = sentences
    .filter((line) =>
      /\b(?:certif|certificate|credential|aws certified|azure|google data analytics|cisco|meta |coursera|udemy|hic|npTEL|pta)\b/i.test(
        line,
      ),
    )
    .slice(0, 3)
    .map((line) => clip(line, 160));

  const experienceMatch = text.match(EXPERIENCE_YEARS);

  return {
    url,
    domain: domainOf(url),
    status: "AVAILABLE",
    reason: null,
    fetchedAt,
    skills,
    fields,
    educationLines,
    projectLines,
    certificationLines,
    experienceYears: experienceMatch ? Number(experienceMatch[1]) : null,
    note: EVIDENCE_NOTE,
  };
}

function unavailable(url: string, reason: string, fetchedAt: string): PublicProfileEvidence {
  return {
    url,
    domain: domainOf(url),
    status: "UNAVAILABLE",
    reason,
    fetchedAt,
    skills: [],
    fields: [],
    educationLines: [],
    projectLines: [],
    certificationLines: [],
    experienceYears: null,
    note: EVIDENCE_NOTE,
  };
}

export const NOT_PROVIDED: PublicProfileEvidence = {
  url: null,
  domain: null,
  status: "NOT_PROVIDED",
  reason: null,
  fetchedAt: null,
  skills: [],
  fields: [],
  educationLines: [],
  projectLines: [],
  certificationLines: [],
  experienceYears: null,
  note: "No public portfolio URL is saved on this profile.",
};

/* ─── In-process cache ────────────────────────────────────────────────────── */

interface CacheEntry {
  evidence: PublicProfileEvidence;
  expiresAt: number;
}

/** Short by design: a portfolio page changes rarely, and a long cache would
 *  show a student skills they removed. Failures cache for less time. */
const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;

const cache = new Map<string, CacheEntry>();

export function clearPublicProfileCache(): void {
  cache.clear();
}

export interface PublicProfileDeps {
  /** Injectable fetcher so tests never touch the network. */
  fetchPage?: (url: string) => Promise<{ text: string; finalUrl: string }>;
  /** Injectable clock for cache/TTL determinism. */
  now?: () => Date;
}

async function defaultFetchPage(url: string): Promise<{ text: string; finalUrl: string }> {
  const content = await fetchWebContent(url, {
    limits: { maxContentChars: 20_000, maxBytes: 512_000, maxRedirects: 3 },
  });
  return { text: content.text, finalUrl: content.finalUrl };
}

/**
 * Read the student's public portfolio as supplementary evidence.
 *
 * Never throws: an unreadable, private, blocked or non-public page comes back
 * as status UNAVAILABLE with a reason, and the profile keeps only what the
 * student actually typed.
 */
export async function getPublicProfileEvidence(
  portfolioUrl: string | null | undefined,
  userId: string,
  deps: PublicProfileDeps = {},
): Promise<PublicProfileEvidence> {
  const url = (portfolioUrl ?? "").trim();
  if (!url) return NOT_PROVIDED;

  const now = deps.now?.() ?? new Date();
  const key = `${userId}::${url}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now.getTime()) return cached.evidence;

  const fetchPage = deps.fetchPage ?? defaultFetchPage;
  let evidence: PublicProfileEvidence;

  try {
    const page = await fetchPage(url);
    const text = (page.text ?? "").trim();
    const finalDomain = domainOf(page.finalUrl || url);

    if (text.length < MIN_USEFUL_CHARS) {
      evidence = unavailable(
        url,
        "The page returned too little readable text to take anything from it.",
        now.toISOString(),
      );
    } else if (PROTECTED_WALL.test(text) && !SKILLS.some((skill) => mentionsToken(normalizeLookup(text), skill))) {
      evidence = unavailable(
        url,
        "The page asks for a login or shows a private profile, so Trustlify read nothing from it.",
        now.toISOString(),
      );
    } else if (finalDomain && finalDomain !== domainOf(url)) {
      // A redirect away from the URL the student saved is worth stating, not
      // silently treating as the same page.
      evidence = {
        ...extractPublicProfileFacts(text, url, now.toISOString()),
        reason: `The link moved to ${finalDomain} before any text was read.`,
      };
    } else {
      evidence = extractPublicProfileFacts(text, url, now.toISOString());
    }
  } catch (error) {
    const code = error instanceof WebFetchError ? error.code : "FETCH_FAILED";
    evidence = unavailable(url, fetchReason(code), now.toISOString());
  }

  const ttl = evidence.status === "AVAILABLE" ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  cache.set(key, { evidence, expiresAt: now.getTime() + ttl });
  return evidence;
}

function fetchReason(code: string): string {
  switch (code) {
    case "URL_REJECTED":
    case "PRIVATE_ADDRESS":
      return "The saved link is not a publicly reachable web address, so Trustlify will not read it.";
    case "TIMEOUT":
      return "The page did not respond in time, so no public profile evidence was read.";
    case "UNSUPPORTED_CONTENT_TYPE":
      return "The link is not an HTML page Trustlify can read as text.";
    case "HTTP_ERROR":
      return "The page refused the request, so nothing could be read from it.";
    case "TOO_MANY_REDIRECTS":
      return "The link kept redirecting, so Trustlify stopped without reading a profile.";
    default:
      return "The page could not be reached, so nothing was added from it.";
  }
}

/**
 * Convert evidence into the two extra fields the matcher may use.
 * Deliberately narrow: skills only. Education, projects and certificates are
 * shown to the student as quotes from the page, but never fed into a hard gate.
 */
export function toMatcherProfileFacts(evidence: PublicProfileEvidence): {
  publicProfileSkills: string[];
  publicProfileDomain: string | null;
} {
  return {
    publicProfileSkills: evidence.status === "AVAILABLE" ? evidence.skills : [],
    publicProfileDomain: evidence.status === "AVAILABLE" ? evidence.domain : null,
  };
}
