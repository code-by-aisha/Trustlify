/**
 * Trustlify Frontend — Deterministic Roman Urdu result templates (update spec 18–19, 26)
 *
 * These tests pin the exact sentences the update specification requires, and the
 * boundary that only Trustlify's own structured presentation is translated.
 * Nothing here can call a network or a model — the module is a static table.
 */

import { describe, it, expect } from 'vitest'
import {
  ROMAN_URDU_SCOPE_NOTE,
  SECTION_LABELS,
  currencyLabel,
  deadlineLabel,
  dimensionRows,
  eligibilityLabel,
  isRomanUrdu,
  outcomeLabel,
  romanUrduBrief,
  sectionLabel,
  verdictLabel,
  verdictSentence,
} from '@/i18n/resultTemplates'
import type {
  DeadlineState,
  DimensionStatus,
  EligibilityResult,
  OpportunityCurrencyState,
  RequirementKind,
  Verdict,
} from '@/types'

const STUDENT_BRIEF = {
  verdict: 'VERIFIED' as Verdict,
  eligibility: 'ELIGIBLE' as EligibilityResult,
  blockers: [] as RequirementKind[],
  currency: 'CURRENT' as OpportunityCurrencyState,
  deadline: 'ACTIVE' as DeadlineState,
}

/* ─── 1. The sentences the spec writes out word for word ──────────────────── */

describe('spec sentences', () => {
  it('says VERIFIED and UNVERIFIED exactly as specified', () => {
    expect(verdictSentence('VERIFIED')).toBe(
      'Ye opportunity available evidence ke mutabiq verified hai.',
    )
    expect(verdictSentence('UNVERIFIED')).toBe(
      'Is opportunity ke liye kafi reliable evidence nahi mila, is liye Trustlify final confirmation nahi kar raha.',
    )
  })

  it('says NOT ELIGIBLE with the education reason exactly as specified', () => {
    const lines = romanUrduBrief({
      ...STUDENT_BRIEF,
      eligibility: 'NOT_ELIGIBLE',
      blockers: ['education'],
    })
    expect(lines).toContain(
      'Aap ke profile ke mutabiq aap is opportunity ke liye eligible nahi hain kyun ke required education level aap ke current education level se match nahi karta.',
    )
  })

  it('says PARTIALLY_ELIGIBLE, CURRENT and EXPIRED exactly as specified', () => {
    expect(romanUrduBrief({ ...STUDENT_BRIEF, eligibility: 'PARTIALLY_ELIGIBLE' })).toContain(
      'Aap ki kuch requirements match karti hain, lekin kuch information missing ya unmatched hai.',
    )
    expect(romanUrduBrief(STUDENT_BRIEF)).toContain(
      'Deadline ke mutabiq ye opportunity abhi active hai.',
    )
    expect(
      romanUrduBrief({
        ...STUDENT_BRIEF,
        currency: 'EXPIRED',
        deadline: 'EXPIRED',
      }),
    ).toContain('Available deadline ke mutabiq application window close ho chuki hai.')
  })
})

/* ─── 2. Every structured state has a template, and none invents a cause ──── */

describe('state coverage', () => {
  const verdicts: Verdict[] = ['VERIFIED', 'CAUTION', 'HIGH_RISK', 'UNVERIFIED']
  const eligibilities: EligibilityResult[] = [
    'ELIGIBLE',
    'PARTIALLY_ELIGIBLE',
    'NOT_ELIGIBLE',
    'INSUFFICIENT_DATA',
  ]
  const currencies: OpportunityCurrencyState[] = [
    'CURRENT',
    'EXPIRED',
    'POSSIBLY_OUTDATED',
    'UNKNOWN',
  ]
  const deadlines: DeadlineState[] = ['ACTIVE', 'EXPIRED', 'CONFLICTING', 'UNKNOWN']

  it('produces a sentence for every verdict, eligibility and currency state', () => {
    for (const verdict of verdicts) {
      expect(verdictSentence(verdict).length).toBeGreaterThan(20)
      expect(verdictLabel(verdict, true)).not.toBe(verdictLabel(verdict, false))
    }
    for (const eligibility of eligibilities) {
      const lines = romanUrduBrief({ ...STUDENT_BRIEF, eligibility })
      expect(lines).toHaveLength(3)
      expect(lines[2].length).toBeGreaterThan(20)
      expect(eligibilityLabel(eligibility, true).length).toBeGreaterThan(3)
    }
    for (const currency of currencies) {
      for (const deadline of deadlines) {
        const lines = romanUrduBrief({ ...STUDENT_BRIEF, currency, deadline })
        expect(lines.length).toBeGreaterThanOrEqual(2)
        expect(currencyLabel(currency, true).length).toBeGreaterThan(3)
        expect(deadlineLabel(deadline, true).length).toBeGreaterThan(3)
      }
    }
    for (const outcome of ['MATCHED', 'MISSING', 'UNKNOWN', 'TIMING'] as const) {
      expect(outcomeLabel(outcome, true).length).toBeGreaterThan(3)
    }
    // Spec 09: the deadline line is labelled as timing, never as a requirement.
    expect(outcomeLabel('TIMING', false)).toContain('NOT AN ELIGIBILITY REQUIREMENT')
    expect(outcomeLabel('TIMING', true)).not.toMatch(/MATCHES YOUR PROFILE/i)
  })

  it('refuses to name a reason it was not given', () => {
    const lines = romanUrduBrief({ ...STUDENT_BRIEF, eligibility: 'NOT_ELIGIBLE', blockers: [] })
    // Generic, honest wording — no invented education or country cause.
    expect(lines[2]).toBe(
      'Aap ke profile ke mutabiq aap is opportunity ke liye eligible nahi hain kyun ke ek zaroori requirement aap ke profile se match nahi karti.',
    )
    expect(lines[2]).not.toContain('education')
    expect(lines[2]).not.toContain('mulk')
  })

  it('names a country or age blocker with the right reason', () => {
    expect(
      romanUrduBrief({ ...STUDENT_BRIEF, eligibility: 'NOT_ELIGIBLE', blockers: ['country'] })[2],
    ).toContain('kyun ke ye opportunity aap ke mulk ke students ke liye nahi hai')
    expect(
      romanUrduBrief({ ...STUDENT_BRIEF, eligibility: 'NOT_ELIGIBLE', blockers: ['age'] })[2],
    ).toContain('kyun ke age limit aap ki umar se match nahi karti')
  })

  it('reports a date conflict instead of an active or closed claim', () => {
    const lines = romanUrduBrief({
      ...STUDENT_BRIEF,
      currency: 'POSSIBLY_OUTDATED',
      deadline: 'CONFLICTING',
    })
    expect(lines[1]).toContain('ek se zyada tareeqe likhe hain')
    expect(lines[1]).toContain('source se confirm karein')
    expect(lines.join(' ')).not.toContain('abhi active hai')
    expect(lines.join(' ')).not.toContain('close ho chuki hai')
  })

  it('keeps the eligibility line out when no comparison was possible', () => {
    const lines = romanUrduBrief({ ...STUDENT_BRIEF, eligibility: null })
    expect(lines).toHaveLength(2)
    expect(lines.join(' ')).not.toMatch(/eligible/i)
  })

  it('keeps the verdict line out when no verdict exists', () => {
    const lines = romanUrduBrief({ ...STUDENT_BRIEF, verdict: null })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('opportunity')
  })
})

/* ─── 3. Language switch is a preference read, not a guess ────────────────── */

describe('language detection', () => {
  it('activates only for the stored Roman Urdu preference', () => {
    expect(isRomanUrdu('Roman Urdu')).toBe(true)
    expect(isRomanUrdu('  roman urdu ')).toBe(true)
    expect(isRomanUrdu('ROMAN URDU')).toBe(true)
    expect(isRomanUrdu('English')).toBe(false)
    expect(isRomanUrdu(null)).toBe(false)
    expect(isRomanUrdu(undefined)).toBe(false)
    expect(isRomanUrdu('Urdu')).toBe(false)
  })

  it('is deterministic — the same state always yields the same strings', () => {
    const first = romanUrduBrief(STUDENT_BRIEF)
    const second = romanUrduBrief({ ...STUDENT_BRIEF })
    expect(second).toEqual(first)
  })
})

/* ─── 4. Scope: labels only, and never a translation service ──────────────── */

describe('translation scope', () => {
  it('gives every structured label a static Roman Urdu pair', () => {
    const keys = Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]
    expect(keys.length).toBeGreaterThanOrEqual(10)
    for (const key of keys) {
      expect(sectionLabel(key, false)).toBe(SECTION_LABELS[key].en)
      expect(sectionLabel(key, true)).toBe(SECTION_LABELS[key].ru)
      expect(SECTION_LABELS[key].ru.length).toBeGreaterThan(2)
      expect(SECTION_LABELS[key].ru).not.toBe(SECTION_LABELS[key].en)
    }
  })

  it('keeps the English labels identical to the ones the page already used', () => {
    // The English strings are the page's original headings — a Roman Urdu user
    // must see the same section names when the mode is off.
    expect(SECTION_LABELS.youAsked.en).toBe('YOU ASKED')
    expect(SECTION_LABELS.currentness.en).toBe('CURRENTNESS')
    expect(SECTION_LABELS.studentMatch.en).toBe('STUDENT MATCH')
    expect(SECTION_LABELS.recommendedSource.en).toBe('RECOMMENDED SOURCE')
    expect(SECTION_LABELS.whyVerdict.en).toBe('WHY THIS VERDICT')
    expect(SECTION_LABELS.recommendedAction.en).toBe('RECOMMENDED ACTION')
    expect(SECTION_LABELS.claims.en).toBe('EXTRACTED CLAIMS')
    expect(SECTION_LABELS.evidence.en).toBe('VERIFIED EVIDENCE')
    expect(SECTION_LABELS.sources.en).toBe('DISCOVERED SOURCES')
  })

  it('states the limit of the mode, including what is never translated', () => {
    expect(ROMAN_URDU_SCOPE_NOTE).toContain('Evidence')
    expect(ROMAN_URDU_SCOPE_NOTE).toContain('quotations')
    expect(ROMAN_URDU_SCOPE_NOTE).toContain('source titles')
    expect(ROMAN_URDU_SCOPE_NOTE).toContain('URLs')
    expect(ROMAN_URDU_SCOPE_NOTE).toContain('sawal')
  })

  it('exposes only synchronous template lookups — there is nothing to await', async () => {
    const module = await import('@/i18n/resultTemplates')
    for (const [, value] of Object.entries(module)) {
      if (typeof value === 'function') {
        // An async lookup would mean a call out to something; none exists.
        expect((value as Function).constructor.name).toBe('Function')
      }
    }
    expect(typeof verdictSentence('VERIFIED')).toBe('string')
    expect(typeof sectionLabel('currentness', true)).toBe('string')
    expect(Array.isArray(romanUrduBrief(STUDENT_BRIEF))).toBe(true)
  })
})

/* ─── Match breakdown rows: what was and was not assessed ─────────────────── */

describe('dimensionRows', () => {
  const ROWS: DimensionStatus[] = [
    {
      kind: 'education',
      state: 'NOT_SATISFIED',
      counted: true,
      source: 'Applicants must hold a bachelor degree',
      detail: 'The opportunity requires Bachelor; your profile is College.',
    },
    {
      kind: 'field',
      state: 'NOT_STATED',
      counted: false,
      source: null,
      detail: 'No field-of-study requirement is stated in this content.',
    },
    {
      kind: 'deadline',
      state: 'SATISFIED',
      counted: false,
      source: 'Apply by 31 Dec 2026',
      detail: 'The recorded deadline is still in the future.',
    },
  ]

  it('renders one row per assessed dimension and never a timing row', () => {
    const rows = dimensionRows(ROWS, false)
    expect(rows.map((row) => row.kind)).toEqual(['education', 'field'])
  })

  it('marks an unstated dimension with ? and keeps it out of the score', () => {
    const field = dimensionRows(ROWS, false).find((row) => row.kind === 'field')!
    expect(field.mark).toBe('?')
    expect(field.counted).toBe(false)
    expect(field.detail).toContain('not counted in the score')
    // A genuine failure keeps its ✗ so the two are never confused.
    const education = dimensionRows(ROWS, false).find((row) => row.kind === 'education')!
    expect(education.mark).toBe('✗')
    expect(education.counted).toBe(true)
  })

  it('translates only its own template line in Roman Urdu', () => {
    const rows = dimensionRows(ROWS, true)
    // Fully templated sentence → translated.
    expect(rows.find((row) => row.kind === 'field')!.detail).toContain('score mein iska hissa nahi')
    // A line quoting the requirement stays in the engine's own words.
    expect(rows.find((row) => row.kind === 'education')!.detail).toContain('Bachelor')
  })

  it('returns nothing for an investigation stored without a breakdown', () => {
    expect(dimensionRows(undefined, false)).toEqual([])
    expect(dimensionRows([], false)).toEqual([])
  })
})
