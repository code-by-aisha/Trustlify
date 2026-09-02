/**
 * Trustlify — Deterministic result templates (English / Roman Urdu)
 *
 * ⚠ NO TRANSLATION API. Roman Urdu here is a fixed template table: the same
 * structured state always produces the same sentence, with no model call and no
 * network request (update spec 18/19).
 *
 * Scope, exactly as the spec limits it: only Trustlify's OWN structured
 * presentation is translated — section headings, status words and the summary
 * sentences built from computed states. Raw evidence, quoted excerpts, source
 * titles, URLs and the user's own input are never altered, because a template
 * cannot restate them faithfully. When a sentence needs real prose it stays
 * English and the card says so.
 */

import type {
  DimensionState,
  DimensionStatus,
  EligibilityResult,
  DeadlineState,
  OpportunityCurrencyState,
  RequirementKind,
  Verdict,
} from '@/types'

/** The persisted label from `profiles.language`. */
export function isRomanUrdu(language: string | null | undefined): boolean {
  return String(language ?? '').trim().toLowerCase() === 'roman urdu'
}

/* ─── Static UI labels ────────────────────────────────────────────────────── */

type Pair = { en: string; ru: string }

export const SECTION_LABELS = {
  youAsked: { en: 'YOU ASKED', ru: 'AAP KA SAWAL' },
  currentness: { en: 'CURRENTNESS', ru: 'AB KI HALAT' },
  studentMatch: { en: 'STUDENT MATCH', ru: 'AAP SE MATCH' },
  dimensionBreakdown: {
    en: 'WHAT WE COULD AND COULDN\'T ASSESS',
    ru: 'HUM NE KYA CHECK KIYA AUR KYA NAHI',
  },
  betterMatches: { en: 'BETTER MATCHES', ru: 'AUR MOUQE' },
  recommendedSource: { en: 'RECOMMENDED SOURCE', ru: 'BEHTAREEN SOURCE' },
  whyVerdict: { en: 'WHY THIS VERDICT', ru: 'YE FAISLA KUN' },
  recommendedAction: { en: 'RECOMMENDED ACTION', ru: 'AGLA QADAM' },
  claims: { en: 'EXTRACTED CLAIMS', ru: 'NIKALE GAYE CLAIMS' },
  evidence: { en: 'VERIFIED EVIDENCE', ru: 'SAHI SABIT GAWAHI' },
  sources: { en: 'DISCOVERED SOURCES', ru: 'MILAY HOWE SOURCES' },
} satisfies Record<string, Pair>

const VERDICT_LABEL: Record<Verdict, Pair> = {
  VERIFIED: { en: 'VERIFIED', ru: 'SAHI SABIT' },
  CAUTION: { en: 'CAUTION', ru: 'EHTIAT KAREIN' },
  HIGH_RISK: { en: 'HIGH RISK', ru: 'AAL TA KHATAR' },
  UNVERIFIED: { en: 'UNVERIFIED', ru: 'CHECK NAHI HO SAKI' },
}

const ELIGIBILITY_LABEL: Record<EligibilityResult, Pair> = {
  ELIGIBLE: { en: 'ELIGIBLE', ru: 'AAP ELIGIBLE HAIN' },
  PARTIALLY_ELIGIBLE: { en: 'PARTIALLY ELIGIBLE', ru: 'KUCH HAD TAK ELIGIBLE' },
  NOT_ELIGIBLE: { en: 'NOT ELIGIBLE', ru: 'AAP ELIGIBLE NAHI HAIN' },
  INSUFFICIENT_DATA: { en: 'NOT ENOUGH DATA', ru: 'KAFI INFORMATION NAHI' },
}

const CURRENCY_LABEL: Record<OpportunityCurrencyState, Pair> = {
  CURRENT: { en: 'CURRENT', ru: 'ABHI ACTIVE HAI' },
  EXPIRED: { en: 'EXPIRED', ru: 'BAND HO CHUKA' },
  POSSIBLY_OUTDATED: { en: 'POSSIBLY OUTDATED', ru: 'SHAYAD PURANA HAI' },
  UNKNOWN: { en: 'CURRENCY UNKNOWN', ru: 'HALAT MALOOM NAHI' },
}

const DEADLINE_LABEL: Record<DeadlineState, Pair> = {
  ACTIVE: { en: 'DEADLINE ACTIVE', ru: 'MIAD KHULI HAI' },
  EXPIRED: { en: 'DEADLINE EXPIRED', ru: 'MIAD GUZAR CHUKI' },
  CONFLICTING: { en: 'DEADLINES CONFLICT', ru: 'TARIKON ME TAZAD' },
  UNKNOWN: { en: 'DEADLINE UNKNOWN', ru: 'KOI MIAD NAHI MILI' },
}

const OUTCOME_LABEL: Record<'MATCHED' | 'MISSING' | 'UNKNOWN' | 'TIMING', Pair> = {
  MATCHED: { en: 'MATCHES YOUR PROFILE', ru: 'AAP KE PROFILE SE MATCH' },
  MISSING: { en: 'NOT MATCHED', ru: 'MATCH NHI KARTA' },
  UNKNOWN: { en: 'UNCONFIRMED', ru: 'MALOOM NAHI' },
  // Spec 09: a deadline is never presented as an eligibility requirement.
  TIMING: { en: 'TIMING (NOT AN ELIGIBILITY REQUIREMENT)', ru: 'MIAD (YE ELIGIBILITY REQUIREMENT NAHI)' },
}

/** Requirement kind words used inside the Roman Urdu blocker sentence. */
const KIND_WORD: Record<RequirementKind, string> = {
  country: 'mulk (country)',
  age: 'umar (age)',
  education: 'taleem level',
  field: 'field of study',
  gpa: 'GPA / marks',
  skills: 'skills',
  experience: 'tajruba (experience)',
  language: 'zaban (language)',
  deadline: 'miad (deadline)',
}

export function sectionLabel(key: keyof typeof SECTION_LABELS, roman: boolean): string {
  return roman ? SECTION_LABELS[key].ru : SECTION_LABELS[key].en
}

export function verdictLabel(verdict: Verdict, roman: boolean): string {
  return roman ? VERDICT_LABEL[verdict].ru : VERDICT_LABEL[verdict].en
}

export function eligibilityLabel(result: EligibilityResult, roman: boolean): string {
  return roman ? ELIGIBILITY_LABEL[result].ru : ELIGIBILITY_LABEL[result].en
}

export function currencyLabel(state: OpportunityCurrencyState, roman: boolean): string {
  return roman ? CURRENCY_LABEL[state].ru : CURRENCY_LABEL[state].en
}

export function deadlineLabel(state: DeadlineState, roman: boolean): string {
  return roman ? DEADLINE_LABEL[state].ru : DEADLINE_LABEL[state].en
}

export function outcomeLabel(
  outcome: 'MATCHED' | 'MISSING' | 'UNKNOWN' | 'TIMING',
  roman: boolean,
): string {
  return roman ? OUTCOME_LABEL[outcome].ru : OUTCOME_LABEL[outcome].en
}

/* ─── Match explanation: what was and was not assessed ────────────────────── */

/**
 * Every dimension the matcher can weigh, in display order. `deadline` is absent
 * on purpose — it is presented as TIMING, never as a quality of the student.
 */
const DIMENSION_LABEL: Record<RequirementKind, Pair> = {
  education: { en: 'EDUCATION LEVEL', ru: 'TALEEM LEVEL' },
  field: { en: 'FIELD OF STUDY', ru: 'FIELD OF STUDY' },
  country: { en: 'COUNTRY', ru: 'MULK (COUNTRY)' },
  skills: { en: 'SKILLS', ru: 'SKILLS' },
  age: { en: 'AGE', ru: 'UMAR (AGE)' },
  experience: { en: 'EXPERIENCE', ru: 'TAJRUBA (EXPERIENCE)' },
  language: { en: 'LANGUAGE', ru: 'ZABAN (LANGUAGE)' },
  gpa: { en: 'GPA / MARKS', ru: 'GPA / MARKS' },
  // Never rendered as a dimension row (kept here so the table is exhaustive);
  // a deadline is shown as TIMING instead.
  deadline: { en: 'TIMING', ru: 'MIAD' },
}

const DIMENSION_STATE_LABEL: Record<DimensionState, Pair> = {
  SATISFIED: { en: 'ASSESSED — SATISFIED', ru: 'CHECK HUA — POORA UTARTA HAI' },
  NOT_SATISFIED: { en: 'ASSESSED — NOT SATISFIED', ru: 'CHECK HUA — NAHI UTARTA' },
  NOT_STATED: { en: 'NOT STATED BY THE SOURCE', ru: 'SOURCE MEIN LIKHI NAHI GAYI' },
  NOT_COMPARABLE: { en: 'STATED — COULD NOT BE CHECKED', ru: 'LIKHI GAYI — CHECK NAHI HO SAKI' },
}

/** Self-contained sentence for a dimension the content never mentioned. */
const NOT_STATED_TEXT: Record<RequirementKind, Pair> = {
  education: {
    en: 'No education-level requirement stated — not counted in the score.',
    ru: 'Koi education-level requirement nahi likhi — score mein iska hissa nahi.',
  },
  field: {
    en: 'No field-of-study requirement stated — not counted in the score.',
    ru: 'Koi field-of-study requirement nahi likhi — score mein iska hissa nahi.',
  },
  country: {
    en: 'No country requirement stated — not counted in the score.',
    ru: 'Koi mulk (country) requirement nahi likhi — score mein iska hissa nahi.',
  },
  skills: {
    en: 'No skills requirement stated — not counted in the score.',
    ru: 'Koi skills requirement nahi likhi — score mein iska hissa nahi.',
  },
  age: {
    en: 'No age requirement stated — not counted in the score.',
    ru: 'Koi umar (age) requirement nahi likhi — score mein iska hissa nahi.',
  },
  experience: {
    en: 'No experience requirement stated — not counted in the score.',
    ru: 'Koi experience requirement nahi likhi — score mein iska hissa nahi.',
  },
  language: {
    en: 'No language requirement stated — not counted in the score.',
    ru: 'Koi zaban (language) requirement nahi likhi — score mein iska hissa nahi.',
  },
  gpa: {
    en: 'No GPA / marks requirement stated — not counted in the score.',
    ru: 'Koi GPA / marks requirement nahi likhi — score mein iska hissa nahi.',
  },
  // Same reason as in DIMENSION_LABEL: exhaustive, never displayed.
  deadline: {
    en: 'No deadline stated — shown under TIMING, never scored.',
    ru: 'Koi miad nahi likhi — TIMING ke tehat dikhai jati hai, score mein nahi.',
  },
}

export interface DimensionRow {
  kind: RequirementKind
  state: DimensionState
  /** ✓ satisfied · ✗ not satisfied · ? not assessed. Never a third meaning. */
  mark: '✓' | '✗' | '?'
  /** Tailwind text color for the mark. */
  tone: string
  label: string
  stateLabel: string
  detail: string
  /** The requirement text this row was judged against, quoted from the source. */
  source: string | null
  counted: boolean
}

const DIMENSION_MARK: Record<DimensionState, { mark: '✓' | '✗' | '?'; tone: string }> = {
  SATISFIED: { mark: '✓', tone: 'text-lime' },
  NOT_SATISFIED: { mark: '✗', tone: 'text-danger' },
  // An unassessed dimension is dim, not caution: nothing is being warned about.
  NOT_STATED: { mark: '?', tone: 'text-dim' },
  NOT_COMPARABLE: { mark: '?', tone: 'text-caution' },
}

/**
 * The rows behind "what we could and could not assess". Pure presentation over
 * the matcher's own `dimensions` payload — no threshold, no recomputation, and
 * an unstated dimension is never rendered as a pass or a fail. Returns [] for
 * persisted investigations written before the breakdown existed.
 */
export function dimensionRows(
  dimensions: DimensionStatus[] | undefined,
  roman: boolean,
): DimensionRow[] {
  if (!dimensions || dimensions.length === 0) return []

  return dimensions
    // Timing is presented as its own quarantined list, not as a dimension.
    .filter((entry) => entry.kind !== 'deadline')
    .map((entry) => {
      const mark = DIMENSION_MARK[entry.state]
      return {
        kind: entry.kind,
        state: entry.state,
        ...mark,
        label: roman ? DIMENSION_LABEL[entry.kind].ru : DIMENSION_LABEL[entry.kind].en,
        stateLabel: roman
          ? DIMENSION_STATE_LABEL[entry.state].ru
          : DIMENSION_STATE_LABEL[entry.state].en,
        // Only the fully-templated line is translated; anything quoting the
        // source's own requirement stays in its original words.
        detail:
          entry.state === 'NOT_STATED'
            ? roman
              ? NOT_STATED_TEXT[entry.kind].ru
              : NOT_STATED_TEXT[entry.kind].en
            : entry.detail,
        counted: entry.counted,
        source: entry.source,
      }
    })
}

/* ─── Structured summary sentences (spec 18 examples) ─────────────────────── */

export interface RomanUrduBriefFacts {
  verdict: Verdict | null
  eligibility: EligibilityResult | null
  /** Requirement kinds that genuinely failed the comparison, if any. */
  blockers: RequirementKind[]
  currency: OpportunityCurrencyState
  deadline: DeadlineState
}

function eligibilitySentence(
  result: EligibilityResult,
  blockers: RequirementKind[],
): string {
  switch (result) {
    case 'ELIGIBLE':
      return 'Aap eligible lagte hain — neeche di gayi requirements aap ke profile se match karti hain.'
    case 'PARTIALLY_ELIGIBLE':
      return 'Aap ki kuch requirements match karti hain, lekin kuch information missing ya unmatched hai.'
    case 'NOT_ELIGIBLE': {
      const first = blockers[0]
      const reason =
        first === 'education'
          ? 'kyun ke required education level aap ke current education level se match nahi karta'
          : first === 'country'
            ? 'kyun ke ye opportunity aap ke mulk ke students ke liye nahi hai'
            : first === 'age'
              ? 'kyun ke age limit aap ki umar se match nahi karti'
              : first === 'deadline'
                ? 'kyun ke application window band ho chuki hai'
                : first
                  ? `kyun ke ${KIND_WORD[first]} aap ke profile se match nahi karta`
                  : 'kyun ke ek zaroori requirement aap ke profile se match nahi karti'
      return `Aap ke profile ke mutabiq aap is opportunity ke liye eligible nahi hain ${reason}.`
    }
    case 'INSUFFICIENT_DATA':
    default:
      return 'Is content mein aap ke profile se compare karne layak koi clear requirement nahi mili, is liye Trustlify eligibility ke baray mein kuch nahi keh raha.'
  }
}

function currencySentence(currency: OpportunityCurrencyState, deadline: DeadlineState): string {
  if (deadline === 'CONFLICTING') {
    return 'Content mein ek se zyada tareeqe likhe hain, is liye miad ke baray mein final baat nahi ki ja rahi — source se confirm karein.'
  }
  switch (currency) {
    case 'CURRENT':
      return deadline === 'ACTIVE'
        ? 'Deadline ke mutabiq ye opportunity abhi active hai.'
        : 'Sources pichle ek saal ke hain, is liye ye opportunity abhi active lag rahi hai.'
    case 'EXPIRED':
      return 'Available deadline ke mutabiq application window close ho chuki hai.'
    case 'POSSIBLY_OUTDATED':
      return 'Sources ek saal se purane hain aur koi deadline nahi mili — isay possibly outdated samjhein.'
    case 'UNKNOWN':
    default:
      return 'Na koi clear deadline mili aur na sources ki publication date, is liye current ya expired kehna theek nahi hoga.'
  }
}

/**
 * The Roman Urdu reading of this result. Three lines, all from computed states:
 * verdict, currency, eligibility. Requirement detail and evidence excerpts stay
 * in English because they are the source's own words.
 */
export function romanUrduBrief(facts: RomanUrduBriefFacts): string[] {
  const lines: string[] = []

  if (facts.verdict) {
    lines.push(verdictSentence(facts.verdict))
  }

  lines.push(currencySentence(facts.currency, facts.deadline))

  if (facts.eligibility) lines.push(eligibilitySentence(facts.eligibility, facts.blockers))

  return lines
}

/** The verdict sentence alone — also reused next to the trust hero. */
export function verdictSentence(verdict: Verdict): string {
  return verdict === 'VERIFIED'
    ? 'Ye opportunity available evidence ke mutabiq verified hai.'
    : verdict === 'UNVERIFIED'
      ? 'Is opportunity ke liye kafi reliable evidence nahi mila, is liye Trustlify final confirmation nahi kar raha.'
      : verdict === 'HIGH_RISK'
        ? 'Evidence mein bade maslay mile hain — bharosa karne se pehle original source se confirm kar lein.'
        : 'Evidence mixed hai — apply karne se pehle neeche di gayi requirements khud check kar lein.'
}

/** Shown once under a Roman Urdu view so the limit of the mode is explicit. */
export const ROMAN_URDU_SCOPE_NOTE =
  'Roman Urdu sirf Trustlify ke apne structured labels aur khulase badalta hai. Evidence, quotations, source titles, URLs aur aap ka likha hua sawal usi zaban mein rehte hain — inko machine translate nahi kiya jata.'
