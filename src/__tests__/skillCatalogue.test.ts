/**
 * Trustlify Frontend — Skill catalogue helpers (fix pass part 1)
 *
 * Pure functions, no rendering and no network: the catalogue is the student's
 * suggestion list, and the helpers are what keep "Python" and "python" from
 * becoming two saved skills.
 */

import { describe, it, expect } from 'vitest'
import {
  INTEREST_CATALOGUE,
  SKILL_CATALOGUE,
  dedupeSkills,
  hasSkill,
  skillKey,
  toggleSkillIn,
} from '@/data/skillCatalogue'

describe('skill catalogue', () => {
  it('is substantially broader than a handful of suggestions', () => {
    expect(SKILL_CATALOGUE.length).toBeGreaterThanOrEqual(20)
    for (const expected of [
      'Python', 'JavaScript', 'React', 'Node.js', 'Full Stack Development',
      'UI/UX Design', 'Figma', 'Data Analysis', 'Machine Learning',
      'Artificial Intelligence', 'Digital Marketing', 'SEO', 'Cybersecurity',
      'Database Management', 'SQL', 'Mobile App Development', 'Project Management',
    ]) {
      expect(SKILL_CATALOGUE).toContain(expected)
    }
  })

  it('contains no duplicates of its own', () => {
    expect(dedupeSkills(SKILL_CATALOGUE)).toHaveLength(SKILL_CATALOGUE.length)
    expect(dedupeSkills(INTEREST_CATALOGUE)).toHaveLength(INTEREST_CATALOGUE.length)
  })
})

describe('skillKey', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(skillKey('  Python ')).toBe(skillKey('PYTHON'))
    expect(skillKey('UI/UX Design')).toBe(skillKey('ui ux design'))
    expect(skillKey('Node.js')).toBe(skillKey('node js'))
    expect(skillKey('   ')).toBe('')
  })
})

describe('dedupeSkills', () => {
  it('keeps the first spelling and drops later variants', () => {
    expect(dedupeSkills(['Python', 'python', 'PYTHON', 'React'])).toEqual(['Python', 'React'])
  })

  it('removes blanks without reordering what is left', () => {
    expect(dedupeSkills(['SQL', '', '  ', 'Figma'])).toEqual(['SQL', 'Figma'])
  })
})

describe('hasSkill / toggleSkillIn', () => {
  it('finds a skill the student already saved under another spelling', () => {
    expect(hasSkill(['Data Analysis'], 'data  analysis')).toBe(true)
    expect(hasSkill(['Data Analysis'], 'data'))
      .toBe(false)
  })

  it('adds a custom skill once and removes it by any spelling', () => {
    const afterAdd = toggleSkillIn(['Python'], 'Drone Photography')
    expect(afterAdd).toEqual(['Python', 'Drone Photography'])
    expect(toggleSkillIn(afterAdd, 'drone photography')).toEqual(['Python'])
  })

  it('never lets a second spelling slip in beside the first', () => {
    expect(toggleSkillIn(['Python'], 'python')).toEqual([])
    // Toggling an existing skill removes it rather than duplicating it.
    expect(toggleSkillIn(['Python', 'React'], 'PYTHON')).toEqual(['React'])
  })
})
