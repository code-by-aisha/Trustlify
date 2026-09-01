/**
 * Trustlify Backend — Similar Opportunity Discovery
 *
 * Only runs when the student explicitly asks for alternatives ("find something
 * similar", "are there better options for me?"). It is never called during an
 * investigation, so no investigation pays for it (update spec 12/23).
 *
 * Cost contract:
 *   - AT MOST 2 Tavily searches per request, built by the code below and
 *     bounded again by MAX_SEARCHES. No Gemini call writes a query, ranks a
 *     result, or phrases a reason.
 *   - The existing TavilySearchProvider is reused — no second search API.
 *
 * Honesty contract:
 *   - A search result is a LEAD, not a verified opportunity. Nothing here says
 *     "you are eligible" unless the same deterministic student matcher
 *     (studentMatcher) reaches that conclusion from requirement phrasing in the
 *     candidate's own snippet text (spec 13).
 *   - Match status is omitted or reported as insufficient data when the snippet
 *     states no comparable requirement. A listing whose snippet only names a
 *     country and a field is a relevance signal, not eligibility (spec 09/10),
 *     and never earns a percentage.
 *   - A listing whose snippet names another country's students is dropped
 *     rather than padded into a third card (spec 15).
 *   - Trust is never inherited from ranking well in a search engine. A
 *     candidate carries a verdict only when Trustlify already stored one for
 *     that exact URL.
 */

import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import type { SearchProvider, SearchResultItem } from "../search/SearchProvider.js";
import { classifySourceType } from "../investigation/sourceNormalizer.js";
import {
  assessDeadline,
  type DeadlineClaimInput,
} from "../engines/currentnessEngine.js";
import {
  calculateStudentMatch,
  countriesMentioned,
  disciplinesIn,
  mentionsToken,
  normalizeLookup,
  SKILLS,
  type RequirementCheck,
  type StudentMatchResult,
  type StudentProfileFacts,
} from "../engines/studentMatcher.js";
import { levelFromEducationText, LEVEL_LABEL } from "../profile/educationLevels.js";

/** Spec 12 is a hard ceiling, not a target. */
export const MAX_SEARCHES = 2;
/** Spec 14: three at most, and fewer is a valid answer. */
export const MAX_RECOMMENDATIONS = 3;
/** A candidate needs more than one overlap signal before it is worth showing. */
const RELEVANCE_FLOOR = 3;
const RESULTS_PER_SEARCH = 6;

export interface SimilarOpportunityContext {
  profile: StudentProfileFacts | null;
  /** Claims of the investigation the student is reacting to. */
  claims: DeadlineClaimInput[];
  submittedUrl: string | null;
  submittedDomain: string | null;
  /** Domains already present in this investigation. */
  knownDomains?: string[];
  now?: Date;
}

export interface SimilarMatchNote {
  result: StudentMatchResult["result"];
  matchScore: number | null;
  checks: RequirementCheck[];
  /** Says out loud how thin the input was. */
  basis: "search snippet";
}

export interface SimilarOpportunity {
  title: string;
  url: string;
  domain: string;
  /** The hostname classification — where it is published, not who owns it. */
  sourceType: string;
  /** Deterministic reasons this was listed, each naming a real signal. */
  why: string[];
  /** Only when the snippet states enough to compare; never a guess. */
  match: SimilarMatchNote | null;
  deadlineIso: string | null;
  deadlineDetail: string | null;
  /** A verdict Trustlify already stored for this exact URL, else null. */
  priorVerdict: string | null;
}

export interface SimilarOpportunitiesResult {
  items: SimilarOpportunity[];
  queries: string[];
  searchesRun: number;
  /** How many raw results were dropped — shown so an empty list is explained. */
  filteredOut: number;
  note: string;
}

const KIND_WORDS = [
  "scholarship", "fellowship", "internship", "grant", "award", "competition",
  "hackathon", "conference", "summer school", "course", "studentship", "bursary",
];

/* ─── Deterministic query building (spec 12: no Gemini for queries) ───────── */

/** The opportunity category the investigated claims actually describe. */
export function opportunityKindOf(claims: DeadlineClaimInput[]): string {
  const text = claims.map((claim) => claim.text).join(" ").toLowerCase();
  let best = "scholarship";
  let bestCount = 0;

  for (const kind of KIND_WORDS) {
    const count = text.split(kind).length - 1;
    if (count > bestCount) {
      best = kind;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : "scholarship";
}

/** Search terms taken only from real profile fields and real claims. */
export function buildDiscoveryQueries(
  context: SimilarOpportunityContext,
): { queries: string[]; terms: string[] } {
  const { profile, claims } = context;
  const now = context.now ?? new Date();
  const year = now.getUTCFullYear();
  const kind = opportunityKindOf(claims);
  const claimText = claims.map((claim) => claim.text).join(" ");

  const country =
    (profile?.country ?? "").trim() ||
    countriesMentioned(profile?.location ?? "")[0] ||
    countriesMentioned(claimText)[0] ||
    "";

  const field =
    (profile?.fieldOfStudy ?? "").trim() ||
    disciplinesIn(`${profile?.education ?? ""} ${(profile?.interests ?? []).join(" ")} ${claimText}`)[0] ||
    "";

  const level = levelFromEducationText(profile?.educationLevel ?? profile?.education ?? "");
  const levelWord =
    level === "POSTGRADUATE" ? "masters"
      : level === "UNDERGRADUATE" || level === "GRADUATE" ? "undergraduate"
      : level === "COLLEGE" || level === "HIGH_SCHOOL" ? "high school"
      : "";

  const skills = (profile?.skills ?? [])
    .filter((skill) => skill.trim())
    .slice(0, 3)
    .map((skill) => skill.trim().toLowerCase());

  const queries: string[] = [];
  const terms: string[] = [];

  queries.push(
    [kind, field, country && `for ${country} students`, levelWord, year]
      .filter(Boolean)
      .join(" "),
  );
  terms.push(...[kind, field, country, levelWord].filter(Boolean));

  // A second search is only spent when there is something different to ask:
  // skills give a genuinely different angle. Otherwise one search is enough.
  if (skills.length > 0 || !field) {
    queries.push(
      [kind, ...skills, country, "applications open", year + 1]
        .filter(Boolean)
        .join(" "),
    );
    terms.push(...skills);
  }

  return { queries: queries.slice(0, MAX_SEARCHES), terms: [...new Set(terms)] };
}

/* ─── Candidate filtering (spec 13) ───────────────────────────────────────── */

interface ScoredCandidate {
  item: SearchResultItem;
  score: number;
  why: string[];
  snippetClaims: DeadlineClaimInput[];
}

/**
 * Split a snippet into short sentence-shaped claims the matcher can read.
 *
 * A non-deadline snippet line is deliberately NOT typed "eligibility". A listing
 * headline such as "74 Scholarships for Computer Science & IT in Pakistan" names a
 * country and a field without stating a single requirement; tagged as an
 * eligibility claim the matcher would count those mentions as satisfied
 * requirements and award the listing ELIGIBLE · 100/100 — the artificial score
 * inflation spec 09/10/13 forbids. With a neutral type a check only fires when
 * the snippet uses requirement phrasing itself ("open to", "must", "eligible",
 * "minimum"…), so whatever status appears is the status the same deterministic
 * matcher would reach from real stated requirements.
 */
function snippetClaimsOf(title: string, snippet: string): DeadlineClaimInput[] {
  return [title, ...snippet.split(/(?<=[.!?])\s+|\n+/)]
    .map((line) => line.trim())
    .filter((line) => line.length >= 20)
    .slice(0, 4)
    .map((text, index) => ({
      id: `snippet-${index + 1}`,
      text,
      // "deadline" is the only type the currentness engine reads from claims.
      type: /\b(deadline|apply by|last date|closing|due date|closes?|open until)\b/i.test(text)
        ? "deadline"
        : "listing",
    }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreCandidate(
  item: SearchResultItem,
  context: SimilarOpportunityContext,
  kind: string,
  terms: string[],
): ScoredCandidate | null {
  const { profile, claims } = context;
  const text = `${item.title} ${item.snippet}`;
  const lookup = normalizeLookup(text);
  const why: string[] = [];
  let score = 0;

  // 1 — the same kind of opportunity as the one investigated.
  if (mentionsToken(lookup, kind)) {
    score += 2;
    why.push(`Lists a ${kind}, the same kind of opportunity you asked about.`);
  }

  // 2 — country: a mention is a signal, another country's restriction is fatal.
  const claimText = claims.map((claim) => claim.text).join(" ");
  const profileCountry =
    (profile?.country ?? "").trim() || countriesMentioned(profile?.location ?? "")[0] || "";
  const wantedCountry = profileCountry || countriesMentioned(claimText)[0] || "";
  const mentioned = countriesMentioned(text);

  if (wantedCountry) {
    if (mentioned.includes(wantedCountry)) {
      score += 2;
      why.push(`Names ${wantedCountry}, the country on your profile.`);
    } else if (mentioned.length > 0) {
      return null;
    }
  }

  // 3 — field of study.
  const wantedFields = [
    (profile?.fieldOfStudy ?? "").trim(),
    disciplinesIn(
      `${profile?.education ?? ""} ${(profile?.interests ?? []).join(" ")} ${claimText}`,
    )[0] ?? "",
    ...terms.flatMap((term) => disciplinesIn(term)),
  ].filter(Boolean);
  const foundFields = disciplinesIn(text).filter((field) => wantedFields.includes(field));
  if (foundFields.length > 0) {
    score += 2;
    why.push(`In your field: ${foundFields.join(", ")}.`);
  }

  // 4 — skills, capped so a keyword-stuffed page cannot win.
  const profileSkills = (profile?.skills ?? []).filter((skill) => skill.trim());
  const overlapSkills = SKILLS.filter(
    (skill) =>
      mentionsToken(lookup, skill) &&
      profileSkills.some((owned) => normalizeLookup(owned) === normalizeLookup(skill)),
  ).slice(0, 2);
  if (overlapSkills.length > 0) {
    score += overlapSkills.length;
    why.push(`Overlaps your skills: ${overlapSkills.join(", ")}.`);
  }

  // 5 — publisher classification (never a claim about who owns the page).
  const sourceType = classifySourceType(item.url);
  if (sourceType === "government" || sourceType === "academic") {
    score += 1;
    why.push(`Published on a ${sourceType.toUpperCase()}-classified domain.`);
  }

  if (score < RELEVANCE_FLOOR) return null;

  return { item, score, why, snippetClaims: snippetClaimsOf(item.title, item.snippet) };
}

/* ─── Discovery ───────────────────────────────────────────────────────────── */

export interface DiscoveryDeps {
  search?: SearchProvider;
  /** Verdicts Trustlify already holds for these exact URLs. */
  priorVerdicts?: (urls: string[]) => Promise<Map<string, string>>;
}

/**
 * Run the discovery. Returns at most three candidates — or none, which is a
 * legitimate answer and is reported as such.
 */
export async function findSimilarOpportunities(
  context: SimilarOpportunityContext,
  deps: DiscoveryDeps = {},
): Promise<SimilarOpportunitiesResult> {
  const now = context.now ?? new Date();
  const { queries, terms } = buildDiscoveryQueries(context);
  const kind = opportunityKindOf(context.claims);
  const provider = deps.search ?? new TavilySearchProvider();

  const submittedUrl = (context.submittedUrl ?? "").replace(/\/+$/, "");
  const excludedDomains = new Set(
    [...(context.knownDomains ?? []), context.submittedDomain ?? ""]
      .map((domain) => domain.toLowerCase().replace(/^www\./, ""))
      .filter(Boolean),
  );

  const raw: SearchResultItem[] = [];
  let searchesRun = 0;

  for (const query of queries.slice(0, MAX_SEARCHES)) {
    searchesRun += 1;
    const output = await provider.search({ query, maxResults: RESULTS_PER_SEARCH });
    raw.push(...output.results);
  }

  // Deduplicate by URL and drop the investigated page itself. Other pages on a
  // domain already seen are kept — a different programme on the same official
  // site is still a new lead, and `excludedDomains` is only used for ranking.
  const byUrl = new Map<string, SearchResultItem>();
  for (const item of raw) {
    const key = (item.url ?? "").replace(/\/+$/, "");
    if (!key || !/^https?:\/\//i.test(key)) continue;
    if (key === submittedUrl) continue;
    if (!byUrl.has(key)) byUrl.set(key, item);
  }

  let filteredOut = 0;
  const candidates: ScoredCandidate[] = [];
  for (const item of byUrl.values()) {
    const scored = scoreCandidate(item, context, kind, terms);
    if (scored) candidates.push(scored);
    else filteredOut += 1;
  }

  const resultRank: Record<StudentMatchResult["result"], number> = {
    ELIGIBLE: 0,
    PARTIALLY_ELIGIBLE: 1,
    INSUFFICIENT_DATA: 2,
    NOT_ELIGIBLE: 3,
  };

  const student = String(context.profile?.role ?? "").toLowerCase() === "student";

  const detailed = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECOMMENDATIONS * 2) // over-collect, then attach detail
    .map((candidate) => {
      const { item, why, snippetClaims } = candidate;
      const domain = hostOf(item.url);

      const match =
        student && context.profile && snippetClaims.length > 0
          ? calculateStudentMatch({
              profile: context.profile as StudentProfileFacts,
              claims: snippetClaims,
              deadline: assessDeadline(snippetClaims, now),
            })
          : null;

      const deadline = assessDeadline(snippetClaims, now);

      return {
        card: {
          title: item.title.slice(0, 180),
          url: item.url,
          domain,
          sourceType: classifySourceType(item.url),
          why,
          match: match
            ? {
                result: match.result,
                matchScore: match.matchScore,
                // Only checks that actually compared something are displayed.
                checks: [...match.matched, ...match.missing].slice(0, 3),
                basis: "search snippet" as const,
              }
            : null,
          deadlineIso: deadline.dates[0]?.iso ?? null,
          deadlineDetail: deadline.state === "UNKNOWN" ? null : deadline.detail,
          priorVerdict: null as string | null,
        } satisfies SimilarOpportunity,
        // Same-domain recommendations are ranked below a fresh domain, never hidden.
        domainAlreadySeen: excludedDomains.has(domain),
        rank: match ? resultRank[match.result] : 2,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.domainAlreadySeen !== b.domainAlreadySeen) return a.domainAlreadySeen ? 1 : -1;
      return 0;
    })
    .slice(0, MAX_RECOMMENDATIONS);

  const items = detailed.map((entry) => entry.card);

  if (deps.priorVerdicts && items.length > 0) {
    const verdicts = await deps.priorVerdicts(items.map((item) => item.url));
    for (const item of items) {
      item.priorVerdict = verdicts.get(item.url) ?? null;
    }
  }

  return {
    items,
    queries,
    searchesRun,
    filteredOut,
    note: items.length
      ? "These are search leads, not verified opportunities. Any match note comes from the listing's own snippet text; opening one runs the normal Trustlify evidence check."
      : "No strong matching opportunities were found.",
  };
}

/** Level label reused by the recommendation UI. */
export function educationLevelLabel(profile: StudentProfileFacts | null): string | null {
  if (!profile) return null;
  const level = levelFromEducationText(profile.educationLevel ?? profile.education ?? "");
  return level ? LEVEL_LABEL[level] : null;
}
