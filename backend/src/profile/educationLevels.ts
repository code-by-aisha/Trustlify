/**
 * Trustlify Backend — Structured Education Levels
 *
 * The student profile historically stores education as one free-text value
 * taken from the onboarding select ("Matric / O-Levels", "BS / Bachelor's" …).
 * Requirement sentences in investigated content are written in yet another
 * vocabulary ("undergraduate students", "HSC holders", "pursuing a Bachelor's").
 *
 * This module is the single deterministic bridge between the two. It contains
 * NO model call and NO network access: fixed tables and ladder arithmetic.
 *
 * Compatibility rule (update spec 02): the free-text `education` column stays
 * the displayed value and is never rewritten. `education_level` is an optional
 * structured companion; when it is absent the level is still derived from the
 * free text so existing profiles keep matching exactly as before.
 */

export const EDUCATION_LEVELS = [
  "HIGH_SCHOOL",
  "COLLEGE",
  "UNDERGRADUATE",
  "GRADUATE",
  "POSTGRADUATE",
  "OTHER",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/**
 * Ladder positions. These deliberately line up with the requirement-side ladder
 * already used in studentMatcher (Matric=1 … PhD=5) so one comparison rule
 * covers both sides.
 *
 * UNDERGRADUATE and GRADUATE share position 3: both are bachelor-level. The
 * difference is enrolment status, which the matcher handles separately rather
 * than by inventing a rank.
 */
export const LEVEL_LADDER: Record<EducationLevel, number | null> = {
  HIGH_SCHOOL: 1,
  COLLEGE: 2,
  UNDERGRADUATE: 3,
  GRADUATE: 3,
  POSTGRADUATE: 4,
  OTHER: null,
};

/** Display label per level — used in every explanation that names the level. */
export const LEVEL_LABEL: Record<EducationLevel, string> = {
  HIGH_SCHOOL: "High school (Matric / O-Levels)",
  COLLEGE: "College (Intermediate / A-Levels)",
  UNDERGRADUATE: "Undergraduate (Bachelor's level)",
  GRADUATE: "Graduate (Bachelor's degree held)",
  POSTGRADUATE: "Postgraduate (Master's / PhD)",
  OTHER: "Other / not classified",
};

/**
 * Exact values the existing onboarding / profile UI offers. Mapping is by full
 * string equality first so nothing is guessed from a partial word.
 */
const UI_OPTION_MAP: Record<string, EducationLevel> = {
  "matric / o-levels": "HIGH_SCHOOL",
  "matric/o-levels": "HIGH_SCHOOL",
  matric: "HIGH_SCHOOL",
  "o-levels": "HIGH_SCHOOL",
  "fsc / a-levels": "COLLEGE",
  "fsc/a-levels": "COLLEGE",
  fsc: "COLLEGE",
  "a-levels": "COLLEGE",
  intermediate: "COLLEGE",
  "bs / bachelor's": "UNDERGRADUATE",
  "bs/bachelor's": "UNDERGRADUATE",
  "bachelor's": "UNDERGRADUATE",
  bachelor: "UNDERGRADUATE",
  "ms / master's": "POSTGRADUATE",
  "ms/master's": "POSTGRADUATE",
  "master's": "POSTGRADUATE",
  master: "POSTGRADUATE",
  mphil: "POSTGRADUATE",
  phd: "POSTGRADUATE",
  "ph.d": "POSTGRADUATE",
  "ph.d.": "POSTGRADUATE",
};

/** Keyword fallback for free text that is not one of the UI options. */
const TEXT_PATTERNS: { level: EducationLevel; pattern: RegExp }[] = [
  { level: "POSTGRADUATE", pattern: /\b(?:ph\.?d|doctorate|doctoral|msc|m\.?sc|mphil|m\.?phil|master|post-?graduate|pgd)\b/i },
  { level: "GRADUATE", pattern: /\b(?:graduate|degree holder|bachelor'?s? (?:degree|holder)|graduated)\b/i },
  { level: "UNDERGRADUATE", pattern: /\b(?:undergraduate|bachelor|b\.?sc|b\.?a\b|b\.?eng|bsc|b\.?com|pursuing|in my \d(?:st|nd|rd|th) year|final year|3rd year|4th year)\b/i },
  { level: "COLLEGE", pattern: /\b(?:fsc|hsc|a[- ]?levels?|intermediate|12th(?:\s+grade)?|college)\b/i },
  { level: "HIGH_SCHOOL", pattern: /\b(?:matric|matriculation|o[- ]?levels?|ssc|high school|10th(?:\s+grade)?|9th(?:\s+grade)?|secondary)\b/i },
];

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Structured level for a free-text education value.
 * Returns null when nothing can be read — the matcher then reports UNKNOWN
 * instead of assuming a qualification the student never stated.
 */
export function levelFromEducationText(
  education: string | null | undefined,
): EducationLevel | null {
  const text = (education ?? "").trim();
  if (!text) return null;

  const exact = UI_OPTION_MAP[normalizeKey(text)];
  if (exact) return exact;

  for (const entry of TEXT_PATTERNS) {
    if (entry.pattern.test(text)) return entry.level;
  }
  return null;
}

/** True when `value` is one of the supported levels. */
export function isEducationLevel(value: unknown): value is EducationLevel {
  return (
    typeof value === "string" &&
    (EDUCATION_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Ladder position for a profile: the structured column wins, the free text is
 * the documented fallback. Null means "no comparable qualification recorded".
 */
export function profileLadderPosition(
  level: string | null | undefined,
  educationText: string | null | undefined,
): number | null {
  if (isEducationLevel(level)) {
    const mapped = LEVEL_LADDER[level];
    if (mapped !== null) return mapped;
  }
  const derived = levelFromEducationText(educationText);
  return derived ? LEVEL_LADDER[derived] : null;
}

/** Label used inside explanations, e.g. "High school (Matric / O-Levels)". */
export function profileLevelLabel(
  level: string | null | undefined,
  educationText: string | null | undefined,
): string | null {
  if (isEducationLevel(level)) return LEVEL_LABEL[level];
  const derived = levelFromEducationText(educationText);
  return derived ? LEVEL_LABEL[derived] : null;
}
