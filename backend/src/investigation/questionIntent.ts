/**
 * Trustlify Backend — Investigation Question Intent
 *
 * The optional question a student attaches to an investigation ("Am I eligible
 * for this?") is CONTEXT, not a new AI task. Classifying its intent is done
 * with deterministic keyword rules only — NEVER a Gemini/LLM call (cost
 * contract, spec 40) and never any network access.
 *
 * Intents (multi-question update, spec 07):
 *   SIMILAR_OPPORTUNITIES — "find something similar", "better options for me"
 *   ELIGIBILITY   — "am I eligible", "who can apply", "requirements"
 *   DEADLINE      — "what is the deadline", "can I still apply"
 *   CURRENTNESS   — "is this outdated", "is this still valid"
 *   LEGITIMACY    — "is this genuine / legit / a scam"
 *   EXPLANATION   — "can you explain this", "summarise it"
 *   GENERAL       — anything not positively matched
 *
 * When a sentence matches several intents, the FIRST matching rule in the order
 * above wins (deterministic priority, never a coin toss).
 *
 * ⚠ The question is UNTRUSTED user input. It is lower-cased and pattern
 * matched as inert data — it can never change pipeline behavior, and it is
 * never interpreted as an instruction.
 */

export const INVESTIGATION_INTENTS = [
  "SIMILAR_OPPORTUNITIES",
  "ELIGIBILITY",
  "DEADLINE",
  "CURRENTNESS",
  "LEGITIMACY",
  "EXPLANATION",
  "GENERAL",
] as const;

export type InvestigationIntent = (typeof INVESTIGATION_INTENTS)[number];

/** Defensive bound — the validator already caps the question at 500 chars. */
const MAX_CLASSIFIED_CHARS = 500;

/* ─── Deterministic keyword rules (ordered by specificity) ────────────────── */

const ELIGIBILITY_PATTERNS: RegExp[] = [
  /\beligib/i,
  /\bqualif/i,
  /\brequirement/i,
  /\bcriteria\b/i,
  /\bwho can apply\b/i,
  /\bcan i apply\b/i,
  /\b(?:am i|i am)\b.{0,24}\bapply\b/i,
  /\bstudents?\b.{0,24}\bcan apply\b/i,
  /\bopen to\b.{0,24}\bstudents?\b/i,
  /\bminimum\b.{0,16}\b(?:gpa|age|degree|cgpa)\b/i,
];

const DEADLINE_PATTERNS: RegExp[] = [
  /\bdeadline/i,
  /\bapply by\b/i,
  /\b(?:last|final|closing)\s+date\b/i,
  /\bdue date\b/i,
  /\bwhen\b.{0,24}\b(?:close|ending|end|expire|deadline)\b/i,
  /\bstill\s+(?:apply|open|accepting|receiving)\b/i,
  /\bhow long\b.{0,24}\b(?:apply|open|deadline)\b/i,
  /\bextended to\b/i,
];

const CURRENTNESS_PATTERNS: RegExp[] = [
  /\boutdated/i,
  /\bstill\s+(?:valid|active|true|current|live)\b/i,
  // "real" is deliberately NOT listed: "Is this real?" asks about legitimacy
  // (spec 08), and LEGITIMACY must stay reachable for it.
  /\bis this\b.{0,16}\b(?:current|active|valid|true)\b/i,
  /\bno longer\b/i,
  /\bcancelled\b|\bcanceled\b/i,
  /\bthis year\b|\blast year\b/i,
  /\b(?:old|new)\b.{0,12}\bnews\b/i,
];

const LEGITIMACY_PATTERNS: RegExp[] = [
  /\blegit/i,
  /\bgenuine/i,
  /\b scam\b|\bscam\b/i,
  /\bfake\b/i,
  /\btrust(?:worthy)?\b/i,
  /\bis this real\b/i,
  /\bfraud/i,
  /\bverified?\b.{0,12}\b(?:or|is)\b/i,
  /\bdangerous\b/i,
];

/**
 * Asking for alternatives changes what the whole page is for, so this intent is
 * checked before the others: "show me similar opportunities I may be eligible
 * for" mentions eligibility, but the student wants a list, not a verdict.
 */
const SIMILAR_PATTERNS: RegExp[] = [
  /\bsimilar\b/i,
  /\balternativ/i,
  /\bother\b.{0,16}\b(?:scholarship|opportunit|grant|fellowship|program|internship|option)s?\b/i,
  /\bbetter\b.{0,16}\b(?:option|choice|fit|match|alternative)s?\b/i,
  /\bmore\b.{0,16}\b(?:option|opportunit|choice)s?\b/i,
  /\brecommend\b/i,
  /\b(?:find|show|suggest|list)\b.{0,24}\b(?:me\b)?.{0,24}\b(?:something|one|ones|options|matches?)\b/i,
  /\banything else\b/i,
  /\bin the same field\b/i,
];

/** "Can you explain this?" — the student wants the result read back to them. */
const EXPLANATION_PATTERNS: RegExp[] = [
  /\bexplain\b/i,
  /\bsummar/i,
  /\bsimplify\b|\bsimple words\b|\belaborate\b/i,
  /\bwhat (?:is|does|are) (?:this|that|it|the)\b/i,
  /\b(?:walk|break)\b.{0,16}\bdown\b/i,
  /\btell me about\b/i,
  /\bmeaning of\b/i,
];

/**
 * Classify the intent behind an investigation question.
 * Pure and deterministic: the same question always yields the same intent.
 * Null/blank/absent questions are GENERAL — in that case the investigation
 * behaves exactly as it did before this feature existed.
 */
export function classifyQuestionIntent(
  question: string | null | undefined,
): InvestigationIntent {
  const text = (question ?? "").slice(0, MAX_CLASSIFIED_CHARS).trim();
  if (!text) return "GENERAL";

  if (SIMILAR_PATTERNS.some((pattern) => pattern.test(text))) {
    return "SIMILAR_OPPORTUNITIES";
  }
  if (ELIGIBILITY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "ELIGIBILITY";
  }
  if (DEADLINE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "DEADLINE";
  }
  if (CURRENTNESS_PATTERNS.some((pattern) => pattern.test(text))) {
    return "CURRENTNESS";
  }
  if (LEGITIMACY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "LEGITIMACY";
  }
  if (EXPLANATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return "EXPLANATION";
  }
  return "GENERAL";
}
