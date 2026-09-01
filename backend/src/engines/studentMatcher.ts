/**
 * Trustlify Backend — Student Match Engine
 *
 * Deterministic comparison of a STUDENT PROFILE against the OPPORTUNITY
 * REQUIREMENTS already present in the investigation's persisted claims.
 *
 * Product contract (student-intelligence update, spec 06/07/17):
 *   - Gemini NEVER calculates this score and never decides eligibility.
 *   - No extra Gemini/Tavily call is made for matching: requirements are read
 *     out of the claims the existing pipeline already extracted (spec 05).
 *   - The same profile + the same claims always produce the same result.
 *   - Missing information is reported as UNKNOWN, never as a guess. A profile
 *     field that does not exist in the schema (e.g. GPA) is honestly reported
 *     as uncomparable instead of being invented (spec 04).
 *
 * Requirement kinds: country, age, education level, field/discipline, GPA,
 * skills, experience, language, deadline.
 *
 * ⚠ Requirement text arrives as untrusted claim content. It is pattern-matched
 * as inert data only — it cannot alter pipeline behavior.
 */

import type { DeadlineAssessment, DeadlineState } from "./currentnessEngine.js";

/* ─── Public model ────────────────────────────────────────────────────────── */

export type RequirementKind =
  | "country"
  | "age"
  | "education"
  | "field"
  | "gpa"
  | "skills"
  | "experience"
  | "language"
  | "deadline";

export type RequirementOutcome = "MATCHED" | "MISSING" | "UNKNOWN";

export interface RequirementCheck {
  kind: RequirementKind;
  /** The real claim text this check was derived from (truncated for display). */
  source: string;
  outcome: RequirementOutcome;
  /** What was actually compared — never generic filler. */
  detail: string;
  /** Hard gates (country/age/education/deadline) can rule a student out. */
  hard: boolean;
}

export type EligibilityResult =
  | "ELIGIBLE"
  | "PARTIALLY_ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "INSUFFICIENT_DATA";

export interface StudentMatchResult {
  result: EligibilityResult;
  /** 0–100, or null when nothing could be checked (no false precision). */
  matchScore: number | null;
  matched: RequirementCheck[];
  missing: RequirementCheck[];
  unknown: RequirementCheck[];
  explanation: string;
}

/**
 * The student facts available in the persisted profile. Mirrors the real
 * `profiles` columns — there is deliberately no GPA field because the schema
 * has none and nothing is invented.
 */
export interface StudentProfileFacts {
  role?: string | null;
  education?: string | null;
  age?: number | null;
  location?: string | null;
  skills?: string[] | null;
  interests?: string[] | null;
  experience?: string | null;
  portfolioUrl?: string | null;
  language?: string | null;
}

export interface RequirementClaim {
  id: string;
  text: string;
  type: string;
}

/* ─── Determination of the score ──────────────────────────────────────────── */

/**
 * matchScore = 100 · (matched + 0.5 · unknown) / total checks.
 *
 * An unknown check earns half credit: it is neither satisfied nor failed, so
 * the score must not pretend it is either. The label comes from the
 * matched/missing facts, never from the number, so the two can't contradict.
 */
function scoreOf(checks: RequirementCheck[]): number | null {
  if (checks.length === 0) return null;
  const matched = checks.filter((check) => check.outcome === "MATCHED").length;
  const unknown = checks.filter((check) => check.outcome === "UNKNOWN").length;
  return Math.round((100 * (matched + 0.5 * unknown)) / checks.length);
}

/* ─── Vocabulary (curated, deterministic) ─────────────────────────────────── */

/**
 * Country names plus the demonyms opportunities actually use. Multi-word keys
 * are underscore-normalized ("united_arab_emirates") to match normalizeLookup.
 */
const COUNTRIES: Record<string, string> = {
  pakistan: "Pakistan", pakistani: "Pakistan",
  india: "India", indian: "India",
  bangladesh: "Bangladesh", bangladeshi: "Bangladesh",
  nigeria: "Nigeria", nigerian: "Nigeria",
  kenya: "Kenya", kenyan: "Kenya",
  egypt: "Egypt", egyptian: "Egypt",
  morocco: "Morocco", moroccan: "Morocco",
  ghana: "Ghana",
  zimbabwe: "Zimbabwe", uganda: "Uganda", tanzania: "Tanzania",
  ethiopia: "Ethiopia", cameroon: "Cameroon",
  south_africa: "South Africa",
  srilanka: "Sri Lanka", nepal: "Nepal", nepali: "Nepal",
  afghanistan: "Afghanistan", afghan: "Afghanistan",
  iran: "Iran", iranian: "Iran", iraq: "Iraq",
  turkey: "Türkiye", turkish: "Türkiye",
  uae: "United Arab Emirates", united_arab_emirates: "United Arab Emirates",
  saudi_arabia: "Saudi Arabia", saudi: "Saudi Arabia",
  qatar: "Qatar", oman: "Oman", kuwait: "Kuwait", bahrain: "Bahrain",
  malaysia: "Malaysia", malaysian: "Malaysia",
  indonesia: "Indonesia", indonesian: "Indonesia",
  philippines: "Philippines", filipino: "Philippines",
  singapore: "Singapore", thailand: "Thailand",
  vietnam: "Vietnam", vietnamese: "Vietnam",
  china: "China", chinese: "China",
  japan: "Japan", japanese: "Japan",
  korea: "South Korea", korean: "South Korea",
  south_korea: "South Korea", north_korea: "North Korea",
  uk: "United Kingdom", united_kingdom: "United Kingdom",
  britain: "United Kingdom", british: "United Kingdom", england: "United Kingdom",
  scotland: "United Kingdom", wales: "United Kingdom",
  usa: "United States", united_states: "United States", american: "United States",
  canada: "Canada", canadian: "Canada",
  australia: "Australia", australian: "Australia",
  new_zealand: "New Zealand",
  germany: "Germany", german: "Germany",
  france: "France", french: "France",
  italy: "Italy", italian: "Italy",
  spain: "Spain", spanish: "Spain",
  netherlands: "Netherlands", dutch: "Netherlands", holland: "Netherlands",
  switzerland: "Switzerland", sweden: "Sweden", norway: "Norway",
  denmark: "Denmark", finland: "Finland", poland: "Poland",
  portugal: "Portugal", portuguese: "Portugal",
  ireland: "Ireland", irish: "Ireland",
  austria: "Austria", belgium: "Belgium", czech: "Czechia",
  hungary: "Hungary", romania: "Romania", greece: "Greece", greek: "Greece",
  russia: "Russia", russian: "Russia", ukraine: "Ukraine",
  brazil: "Brazil", brazilian: "Brazil",
  mexico: "Mexico", mexican: "Mexico",
  argentina: "Argentina", chile: "Chile", colombia: "Colombia",
  peru: "Peru", venezuela: "Venezuela",
  europe: "Europe", european: "Europe",
};

/** Multi-word country names, longest first so phrases win over tokens. */
const COUNTRY_PHRASES = [
  "united arab emirates",
  "united states of america",
  "united states",
  "united kingdom",
  "saudi arabia",
  "south korea",
  "north korea",
  "sri lanka",
  "new zealand",
  "south africa",
];

/** Field-of-study aliases. Deliberately no 2-letter aliases ('it', 'in'). */
const DISCIPLINES: Record<string, string[]> = {
  "computer science": ["computer science", "computer sciences", "software engineering", "computing"],
  "information technology": ["information technology", "informatics", "information systems"],
  "data science": ["data science", "data analysis", "statistics", "statistical", "actuarial"],
  engineering: ["engineering", "engineer", "mechanical", "electrical", "electronics", "civil", "chemical", "telecommunication", "industrial engineering", "robotics", "mechatronics"],
  medicine: ["medicine", "medical", "nursing", "public health", "pharmacy", "dental", "dentistry", "clinical"],
  biology: ["biology", "biotechnology", "biotech", "life science", "life sciences", "zoology", "botany", "genetics", "microbiology"],
  chemistry: ["chemistry", "biochemistry"],
  physics: ["physics", "astronomy", "astrophysics", "nuclear"],
  mathematics: ["mathematics", "maths", "applied math"],
  business: ["business", "commerce", "management", "mba", "entrepreneurship", "supply chain"],
  accounting: ["accounting", "finance", "banking", "audit"],
  economics: ["economics", "econometrics"],
  law: ["law", "legal", "llb", "llm", "juris"],
  education: ["education", "teaching", "pedagogy", "english language teaching"],
  "social science": ["social science", "sociology", "anthropology", "political science", "international relations", "psychology", "development studies"],
  media: ["media", "communication studies", "journalism", "mass communication"],
  design: ["design", "graphic design", "architecture", "urban planning", "fine arts", "visual arts"],
  agriculture: ["agriculture", "agronomy", "veterinary", "food science", "crop"],
  environmental: ["environmental", "climate", "sustainability", "ecology", "marine"],
  energy: ["energy", "petroleum", "renewable", "solar"],
  linguistics: ["linguistics", "translation", "languages"],
  stem: ["stem"],
};

/** Concrete skills opportunities ask for. No single-letter entries. */
const SKILLS: string[] = [
  "python", "java", "javascript", "typescript", "react", "node", "sql", "excel",
  "power bi", "tableau", "machine learning", "deep learning", "data analysis",
  "web development", "mobile development", "cybersecurity", "networking", "linux",
  "git", "autocad", "matlab", "solidworks", "photoshop", "illustrator", "figma",
  "video editing", "content writing", "copywriting", "seo", "digital marketing",
  "graphic design", "ui ux", "project management", "academic writing", "research",
  "data entry", "accounting", "bookkeeping", "communication skills", "presentation",
  "teaching", "training", "volunteering", "survey design", "spss", "stata",
];

/** Education ladder — higher number = higher qualification. */
const EDUCATION_KEYWORDS: { level: number; pattern: RegExp; label: string }[] = [
  { level: 5, pattern: /\b(?:ph\.?d|phd|doctorate|doctoral)\b/i, label: "PhD" },
  { level: 4, pattern: /\b(?:master|master's|msc|m\.?sc|mba|m\.?eng|mphil|m\.?phil|postgraduate|post-graduate|pgd)\b/i, label: "Master's" },
  { level: 3, pattern: /\b(?:bachelor|bachelor's|b\.?sc|b\.?a\b|b\.?eng|bsc|undergraduate|graduate|degree holder)\b/i, label: "Bachelor's" },
  { level: 2, pattern: /\b(?:intermediate|fsc|hsc|a[- ]?level|12th grade|high school)\b/i, label: "Intermediate / high school" },
  { level: 1, pattern: /\b(?:matric|matriculation|o[- ]?level|ssc|9th grade|10th grade|secondary)\b/i, label: "Matric / secondary" },
];

/** Phrases that restrict to currently-enrolled students (not a qualification). */
const ENROLMENT_PHRASE =
  /\b(?:final year|last year|freshman|sophomore|junior|senior|currently enrolled|enrolled in|still studying|undergraduate students|graduate students|masters students|phd students)\b/i;

/** Requirement phrasing that makes a plain sentence a criterion. */
const REQUIREMENT_HINT =
  /\b(?:require|requires|required|must|should|minimum|max(?:imum)?|at least|up to|eligible|eligibilit|open to|seeking|looking for|who can apply|prefer|preferred|criteria|qualif)\b/i;

/** An age requirement always says so — "age", "aged", or "N years old". */
const AGE_MENTION = /\bage\b|\baged\b|\byears?\s+old\b/i;

/** Wording that makes a country mention an exclusive restriction. */
const EXCLUSIVE_COUNTRY =
  /\b(?:only|must|reserved|restricted|exclusiv|citizens? of|nationals? of|residents? of|domestic applicants?|not open to)\b/i;

const LANGUAGE_NAMES: Record<string, string> = {
  english: "English", urdu: "Urdu", german: "German", french: "French",
  spanish: "Spanish", chinese: "Chinese", mandarin: "Chinese",
  arabic: "Arabic", turkish: "Turkish", japanese: "Japanese",
  portuguese: "Portuguese", italian: "Italian",
};

const TEST_SCORE_PHRASE = /\b(?:ielts|toefl|duolingo english test|pte)\b/i;

const GPA_PHRASE =
  /\b(?:gpa|cgpa|grade point average|aggregate|percentage of marks|minimum marks|first division|distinction|second division)\b/i;

/** Cap the checks surfaced per investigation — display sanity, deterministic. */
const MAX_CHECKS = 12;

/* ─── Text helpers (pure) ─────────────────────────────────────────────────── */

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/** "Open to Pakistani students" → "open_to_pakistani_students" */
function normalizeLookup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** True when `needle` appears in the normalized `haystack` as a whole token(s). */
function mentionsToken(haystack: string, needle: string): boolean {
  const key = normalizeLookup(needle);
  if (!key) return false;
  const padded = `_${haystack}_`;
  return padded.includes(`_${key}_`);
}

function mentionsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => mentionsToken(haystack, needle));
}

/**
 * Education ladder position for free text ("BS Computer Science" → 3).
 * Null when no recognisable qualification is stated — never assumed.
 */
function educationLevel(text: string | null | undefined): number | null {
  if (!text) return null;
  for (const entry of EDUCATION_KEYWORDS) {
    if (entry.pattern.test(text)) return entry.level;
  }
  return null;
}

/** Years of experience demanded by a requirement sentence. */
export function requiredYearsOfExperience(text: string): number | null {
  const direct = text.match(
    /\b(\d{1,2})\s*\+?\s*years?\b[^\n]{0,20}?\bexperience\b/i,
  );
  if (direct) return Number(direct[1]);
  const reversed = text.match(
    /\bexperience\b[^\n]{0,20}?\b(\d{1,2})\s*\+?\s*years?\b/i,
  );
  if (reversed) return Number(reversed[1]);
  return null;
}

/**
 * Countries named in a piece of text, in first-mention order. Phrases are
 * matched before single tokens so "United Arab Emirates" is not read as
 * "United" + "Arab" + "Emirates".
 */
export function countriesMentioned(text: string): string[] {
  const lookup = normalizeLookup(text);
  const found: string[] = [];

  for (const phrase of COUNTRY_PHRASES) {
    if (mentionsToken(lookup, phrase)) {
      const country = COUNTRIES[normalizeLookup(phrase)];
      if (country && !found.includes(country)) found.push(country);
    }
  }

  for (const token of lookup.split("_")) {
    const country = COUNTRIES[token];
    if (country && !found.includes(country)) found.push(country);
  }

  return found;
}

/* ─── Requirement extraction (spec 05 — reuse the existing claims) ────────── */

export interface RawRequirement {
  kind: RequirementKind;
  source: string;
}

const COUNTRY_RELEVANT_CLAIM =
  /\b(?:eligib|applicants?|students?|nationals?|citizens?|residents?|open to|apply|available to)\b/i;

const NO_COUNTRY_RESTRICTION =
  /\b(?:all nationalit|any nationalit|no nationality|open to all|worldwide|globally|all countries|international students are welcome)\b/i;

/**
 * Identify requirement-type statements inside the already-extracted claims.
 * No AI call — keyword/structure detection over persisted claim text only.
 */
export function extractRequirements(claims: RequirementClaim[]): RawRequirement[] {
  const requirements: RawRequirement[] = [];

  const push = (kind: RequirementKind, claim: RequirementClaim) => {
    if (
      !requirements.some(
        (entry) => entry.kind === kind && entry.source === claim.text,
      )
    ) {
      requirements.push({ kind, source: claim.text });
    }
  };

  for (const claim of claims) {
    const text = claim.text ?? "";
    if (!text.trim()) continue;

    const lookup = normalizeLookup(text);
    const isCriterionShape =
      claim.type === "eligibility" || REQUIREMENT_HINT.test(text);

    /* Deadline — date semantics are resolved by the currentness engine */
    if (claim.type === "deadline") push("deadline", claim);

    /* Country eligibility */
    if (
      !NO_COUNTRY_RESTRICTION.test(text) &&
      (claim.type === "eligibility" ||
        claim.type === "location" ||
        COUNTRY_RELEVANT_CLAIM.test(text)) &&
      countriesMentioned(text).length > 0
    ) {
      push("country", claim);
    }

    if (!isCriterionShape) continue;

    /* Age */
    if (AGE_MENTION.test(text)) {
      push("age", claim);
    }

    /* Education level (and enrolment-only opportunities) */
    if (EDUCATION_KEYWORDS.some((entry) => entry.pattern.test(text))) {
      push("education", claim);
    }

    /* Field / discipline */
    if (
      Object.entries(DISCIPLINES).some(
        ([name, aliases]) => mentionsAny(lookup, aliases) || mentionsToken(lookup, name),
      )
    ) {
      push("field", claim);
    }

    /* GPA / grades — uncomparable against the current schema */
    if (GPA_PHRASE.test(text)) push("gpa", claim);

    /* Concrete skills */
    if (mentionsAny(lookup, SKILLS)) push("skills", claim);

    /* Experience */
    if (/\bexperience\b/i.test(text)) push("experience", claim);

    /* Language */
    if (
      TEST_SCORE_PHRASE.test(text) ||
      mentionsAny(lookup, Object.keys(LANGUAGE_NAMES))
    ) {
      push("language", claim);
    }
  }

  return requirements;
}

/* ─── One requirement compared against the profile ────────────────────────── */

function checkCountry(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const required = countriesMentioned(claim);
  const requirementLabel = required.join(", ");
  const base = {
    kind: "country" as const,
    source: truncate(claim, 160),
    hard: EXCLUSIVE_COUNTRY.test(claim),
  };
  const profileCountry = profile.location
    ? countriesMentioned(profile.location)[0] ?? null
    : null;

  if (!profile.location?.trim()) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity mentions ${requirementLabel}, but your profile has no location recorded.` };
  }
  if (!profileCountry) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity mentions ${requirementLabel}; your profile location "${truncate(profile.location, 60)}" does not name a country, so it cannot be compared.` };
  }
  if (required.includes(profileCountry)) {
    return { ...base, outcome: "MATCHED", detail: `Your location: ${profileCountry} — named in the requirement (${requirementLabel}).` };
  }
  return { ...base, outcome: "MISSING", detail: `The requirement names ${requirementLabel}; your profile location is ${profileCountry}.` };
}

function checkAge(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "age" as const, source: truncate(claim, 160), hard: true };

  const range = claim.match(/\b(\d{1,3})\s*(?:-|–|to|and)\s*(\d{1,3})\b/);
  const under = claim.match(/\b(?:under|below|not more than|maximum(?:\s+age)?|up to)\s+(\d{1,3})\b/i);
  const atLeast = claim.match(/\b(?:at least|minimum(?:\s+age)?|older than)\s+(\d{1,3})\b/i);
  const plus = claim.match(/\b(\d{1,3})\s*\+\s*(?:years?\s+old)?\b/i);
  const exclusiveMax = /\b(?:under|below)\s+\d{1,3}\b/i.test(claim);

  let min: number | null = range ? Number(range[1]) : null;
  let max: number | null = range ? Number(range[2]) : null;
  if (min === null && atLeast) min = Number(atLeast[1]);
  if (min === null && plus) min = Number(plus[1]);
  if (max === null && under) max = Number(under[1]);

  if (min === null && max === null) {
    return { ...base, outcome: "UNKNOWN", detail: "No explicit age limit could be read from the requirement." };
  }

  const stated =
    max !== null && min === null
      ? `under ${max}`
      : min !== null && max === null
        ? `${min} or older`
        : `${min}–${max}`;

  if (profile.age === null || profile.age === undefined) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity asks for ${stated}, but your profile has no age recorded.` };
  }
  const belowMin = min !== null && profile.age < min;
  const aboveMax = max !== null && (exclusiveMax ? profile.age >= max : profile.age > max);
  if (belowMin || aboveMax) {
    return { ...base, outcome: "MISSING", detail: `The opportunity asks for ${stated}; your profile age is ${profile.age}.` };
  }
  return { ...base, outcome: "MATCHED", detail: `The opportunity asks for ${stated}; your profile age is ${profile.age}.` };
}

function checkEducation(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "education" as const, source: truncate(claim, 160), hard: true };
  const found = EDUCATION_KEYWORDS.filter((entry) => entry.pattern.test(claim));
  const profileLabel = truncate(profile.education?.trim() || "(not recorded)", 60);

  if (found.length === 0) {
    return { ...base, outcome: "UNKNOWN", detail: "No recognisable education level could be read from the requirement." };
  }

  // An inclusive list ("Bachelor, Master and PhD students") sets the floor at
  // the LOWEST level named; a single mention sets that level itself.
  const requiredLevel = Math.min(...found.map((entry) => entry.level));
  const requiredLabel =
    found.find((entry) => entry.level === requiredLevel)?.label ?? "degree-level";

  const profileLevel = educationLevel(profile.education);
  if (profileLevel === null) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity targets ${requiredLabel}-level applicants; your profile education "${profileLabel}" states no comparable qualification.` };
  }
  if (profileLevel < requiredLevel) {
    return { ...base, outcome: "MISSING", detail: `The opportunity targets ${requiredLabel}-level applicants; your profile records ${profileLabel}.` };
  }
  if (ENROLMENT_PHRASE.test(claim)) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity is aimed at currently-enrolled students; your profile records your highest qualification (${profileLabel}), not your enrolment status.` };
  }
  return { ...base, outcome: "MATCHED", detail: `The opportunity targets ${requiredLabel}-level applicants; your profile records ${profileLabel}.` };
}

function disciplinesIn(text: string): string[] {
  const lookup = normalizeLookup(text);
  return Object.entries(DISCIPLINES)
    .filter(([name, aliases]) => mentionsAny(lookup, aliases) || mentionsToken(lookup, name))
    .map(([name]) => name);
}

function checkField(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "field" as const, source: truncate(claim, 160), hard: false };
  const required = disciplinesIn(claim);

  if (required.length === 0) {
    return { ...base, outcome: "UNKNOWN", detail: "No identifiable field of study in the requirement." };
  }

  const profileText = [
    profile.education ?? "",
    (profile.skills ?? []).join(" "),
    (profile.interests ?? []).join(" "),
    profile.experience ?? "",
  ].join(" ");

  if (!profileText.trim()) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity targets ${required.join(", ")}; your profile records no field of study, skills, interests, or experience to compare.` };
  }

  const satisfied = disciplinesIn(profileText).filter((name) => required.includes(name));
  if (satisfied.length > 0) {
    return { ...base, outcome: "MATCHED", detail: `The opportunity targets ${required.join(", ")}; your profile covers ${satisfied.join(", ")}.` };
  }
  return { ...base, outcome: "MISSING", detail: `The opportunity targets ${required.join(", ")}; nothing in your profile education, skills, interests, or experience names that field.` };
}

function checkGpa(claim: string): RequirementCheck {
  return {
    kind: "gpa",
    source: truncate(claim, 160),
    outcome: "UNKNOWN",
    hard: false,
    detail: `The requirement states "${truncate(claim, 120)}", but your profile has no GPA/CGPA field — Trustlify does not guess a grade.`,
  };
}

function checkSkills(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "skills" as const, source: truncate(claim, 160), hard: false };
  const claimLookup = normalizeLookup(claim);
  const required = SKILLS.filter((skill) => mentionsToken(claimLookup, skill));

  if (required.length === 0) {
    return { ...base, outcome: "UNKNOWN", detail: "No specific skill could be read from the requirement." };
  }

  const profileSkills = (profile.skills ?? []).filter((skill) => skill.trim());
  if (profileSkills.length === 0) {
    return { ...base, outcome: "UNKNOWN", detail: `The requirement mentions ${required.join(", ")}; your profile has no skills recorded.` };
  }

  const profileLookup = normalizeLookup(profileSkills.join(" "));
  const satisfied = required.filter((skill) => mentionsToken(profileLookup, skill));
  if (satisfied.length > 0) {
    return { ...base, outcome: "MATCHED", detail: `The requirement mentions ${required.join(", ")}; your profile lists ${satisfied.join(", ")}.` };
  }
  return {
    ...base,
    outcome: "MISSING",
    detail: `The requirement mentions ${required.join(", ")}; your profile lists ${truncate(profileSkills.join(", "), 90)} — none of them match.`,
  };
}

function checkExperience(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "experience" as const, source: truncate(claim, 160), hard: false };
  const requiredYears = requiredYearsOfExperience(claim);
  const profileExperience = (profile.experience ?? "").trim();

  if (!/\bexperience\b/i.test(claim)) {
    return { ...base, outcome: "UNKNOWN", detail: "No experience requirement could be read from the statement." };
  }
  if (!profileExperience) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity mentions experience${requiredYears ? ` (${requiredYears} year${requiredYears === 1 ? "" : "s"})` : ""}; your profile records no experience.` };
  }

  if (requiredYears === null) {
    return { ...base, outcome: "MATCHED", detail: `The opportunity looks for experience; your profile records: ${truncate(profileExperience, 90)}.` };
  }

  const yearsMatch = profileExperience.match(/\b(\d{1,2})\s*\+?\s*years?\b/i);
  const profileYears = yearsMatch ? Number(yearsMatch[1]) : null;

  if (profileYears === null) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity asks for ${requiredYears} year(s) of experience; your profile records experience ("${truncate(profileExperience, 70)}") but no duration that can be compared.` };
  }
  if (profileYears < requiredYears) {
    return { ...base, outcome: "MISSING", detail: `The opportunity asks for ${requiredYears} year(s) of experience; your profile records ${profileYears}.` };
  }
  return { ...base, outcome: "MATCHED", detail: `The opportunity asks for ${requiredYears} year(s) of experience; your profile records ${profileYears}.` };
}

function checkLanguage(claim: string, profile: StudentProfileFacts): RequirementCheck {
  const base = { kind: "language" as const, source: truncate(claim, 160), hard: false };

  if (TEST_SCORE_PHRASE.test(claim)) {
    const test = claim.match(TEST_SCORE_PHRASE)?.[0].toUpperCase() ?? "a language test";
    return { ...base, outcome: "UNKNOWN", detail: `The requirement states a ${test} score; your profile stores no test score to compare.` };
  }

  const claimLookup = normalizeLookup(claim);
  const required = Object.entries(LANGUAGE_NAMES)
    .filter(([name]) => mentionsToken(claimLookup, name))
    .map(([, label]) => label);

  if (required.length === 0) {
    return { ...base, outcome: "UNKNOWN", detail: "No language requirement could be read from the statement." };
  }

  const profileLanguage = (profile.language ?? "").trim();
  const profileExtras = normalizeLookup(
    [...(profile.skills ?? []), ...(profile.interests ?? [])].join(" "),
  );

  const satisfied = required.filter(
    (label) =>
      label.toLowerCase() === profileLanguage.toLowerCase() ||
      mentionsToken(profileExtras, label),
  );
  if (satisfied.length > 0) {
    return { ...base, outcome: "MATCHED", detail: `The opportunity requires ${required.join(", ")}; your profile records ${satisfied.join(", ")}.` };
  }
  if (!profileLanguage && !profileExtras) {
    return { ...base, outcome: "UNKNOWN", detail: `The opportunity requires ${required.join(", ")}; your profile records no language information.` };
  }
  return { ...base, outcome: "MISSING", detail: `The opportunity requires ${required.join(", ")}; your profile language is ${profileLanguage || "unspecified"}.` };
}

function checkDeadline(claim: string, deadline: DeadlineAssessment | null): RequirementCheck {
  const state: DeadlineState = deadline?.state ?? "UNKNOWN";
  const detail = deadline?.detail ?? null;

  if (state === "ACTIVE") {
    return { kind: "deadline", source: truncate(claim, 160), outcome: "MATCHED", hard: true, detail: detail ?? "The recorded deadline is still in the future." };
  }
  if (state === "EXPIRED") {
    return { kind: "deadline", source: truncate(claim, 160), outcome: "MISSING", hard: true, detail: detail ?? "The recorded deadline has passed." };
  }
  return {
    kind: "deadline",
    source: truncate(claim, 160),
    outcome: "UNKNOWN",
    hard: false,
    detail:
      detail ??
      "No complete deadline date could be read, so the application window cannot be assessed.",
  };
}

/* ─── Entry point ─────────────────────────────────────────────────────────── */

export interface StudentMatchInput {
  profile: StudentProfileFacts;
  claims: RequirementClaim[];
  /** Deadline assessment over the same persisted claims — never re-derived. */
  deadline?: DeadlineAssessment | null;
}

/**
 * Compare the student profile against the opportunity requirements found in the
 * investigation's own claims. Pure function: same input, same output, always.
 */
export function calculateStudentMatch(input: StudentMatchInput): StudentMatchResult {
  const { profile, claims, deadline = null } = input;

  const requirements = extractRequirements(claims).slice(0, MAX_CHECKS);

  const checks: RequirementCheck[] = requirements.map((requirement) => {
    switch (requirement.kind) {
      case "country":
        return checkCountry(requirement.source, profile);
      case "age":
        return checkAge(requirement.source, profile);
      case "education":
        return checkEducation(requirement.source, profile);
      case "field":
        return checkField(requirement.source, profile);
      case "gpa":
        return checkGpa(requirement.source);
      case "skills":
        return checkSkills(requirement.source, profile);
      case "experience":
        return checkExperience(requirement.source, profile);
      case "language":
        return checkLanguage(requirement.source, profile);
      case "deadline":
        return checkDeadline(requirement.source, deadline);
      default:
        return {
          kind: requirement.kind,
          source: truncate(requirement.source, 160),
          outcome: "UNKNOWN",
          hard: false,
          detail: "This requirement type cannot be compared deterministically.",
        };
    }
  });

  const matched = checks.filter((check) => check.outcome === "MATCHED");
  const missing = checks.filter((check) => check.outcome === "MISSING");
  const unknown = checks.filter((check) => check.outcome === "UNKNOWN");

  // A deadline is a currency signal, not a quality of the student. Counting it
  // as a matched "requirement" would let an open application window alone
  // declare someone ELIGIBLE — so the label and the score come only from the
  // checks that actually compare a profile fact with a stated requirement.
  // The deadline check stays in the lists because it is real, useful context.
  const comparable = checks.filter((check) => check.kind !== "deadline");
  const matchScore = scoreOf(comparable);

  const comparableMatched = comparable.filter((check) => check.outcome === "MATCHED");
  const comparableMissing = comparable.filter((check) => check.outcome === "MISSING");
  const comparableUnknown = comparable.filter((check) => check.outcome === "UNKNOWN");

  let result: EligibilityResult;
  if (
    comparable.length === 0 ||
    (comparableMatched.length === 0 && comparableMissing.length === 0)
  ) {
    result = "INSUFFICIENT_DATA";
  } else if (comparableMissing.some((check) => check.hard)) {
    result = "NOT_ELIGIBLE";
  } else if (
    comparableMissing.length > 0 ||
    (comparableMatched.length > 0 && comparableUnknown.length > 0)
  ) {
    result = "PARTIALLY_ELIGIBLE";
  } else {
    result = "ELIGIBLE";
  }

  return {
    result,
    matchScore,
    matched,
    missing,
    unknown,
    explanation: buildExplanation(result, matchScore, matched, missing, unknown, comparable),
  };
}

/**
 * Deterministic explanation assembled from the comparison itself — every line
 * names a real requirement and the real profile fact it was weighed against.
 */
function buildExplanation(
  result: EligibilityResult,
  matchScore: number | null,
  matched: RequirementCheck[],
  missing: RequirementCheck[],
  unknown: RequirementCheck[],
  /** Checks that compare a profile fact (deadline excluded). */
  comparable: RequirementCheck[],
): string {
  const total = matched.length + missing.length + unknown.length;
  const scoreLabel =
    matchScore === null
      ? "no requirement in this content could be checked against your profile"
      : `${matchScore}% of ${comparable.length} comparable requirement${comparable.length === 1 ? "" : "s"} counted in your favour`;

  const lines: string[] = [];

  if (result === "ELIGIBLE") {
    lines.push(
      `Every requirement this content states that can be compared with your profile matched (${scoreLabel}).`,
    );
  } else if (result === "PARTIALLY_ELIGIBLE") {
    lines.push(
      `Your profile matched ${comparable.filter((c) => c.outcome === "MATCHED").length} of ${comparable.length} comparable requirement(s) and nothing found so far rules you out (${scoreLabel}).`,
    );
    if (missing.length > 0) {
      lines.push(`Not satisfied: ${[...new Set(missing.map((check) => check.kind))].join(", ")}.`);
    }
  } else if (result === "NOT_ELIGIBLE") {
    lines.push(
      `At least one decisive requirement is not satisfied by your profile (${scoreLabel}).`,
    );
    lines.push(
      `Blocking: ${[...new Set(missing.filter((check) => check.hard).map((check) => check.kind))].join(", ")}.`,
    );
  } else {
    const foundKinds = [...new Set([...matched, ...missing, ...unknown].map((check) => check.kind))];
    lines.push(
      comparable.length === 0 && total > 0
        ? `This content stated no eligibility requirement that can be compared with your profile — only ${foundKinds.join(", ")} — so no eligibility claim is made.`
        : total === 0
          ? "No checkable eligibility requirement could be read from this content, so nothing about your fit can be said."
          : `The ${comparable.length} requirement(s) found could not be compared against your profile (${scoreLabel}), so no eligibility claim is made.`,
    );
  }

  if (unknown.length > 0 && result !== "INSUFFICIENT_DATA") {
    lines.push(
      `Could not be verified: ${[...new Set(unknown.map((check) => check.kind))].join(", ")}.`,
    );
  }
  lines.push(
    "Eligibility is decided by the organisation, not by Trustlify — confirm on the source page before applying.",
  );

  return lines.join("\n");
}
