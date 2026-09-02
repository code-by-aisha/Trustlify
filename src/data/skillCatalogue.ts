/**
 * Trustlify — Student skill catalogue
 *
 * One reusable preset list for every place a student records skills
 * (onboarding step 03 and Settings → Profile). The student's own
 * `skills: string[]` is the only thing persisted, so a custom skill that is
 * not in this catalogue is stored exactly like a preset one — the matcher
 * reads `profile.skills` and never needs to know where a skill came from.
 */

/** Preset suggestions — deliberately broader than a handful of options. */
export const SKILL_CATALOGUE: readonly string[] = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Full Stack Development',
  'Web Development',
  'UI/UX Design',
  'Figma',
  'Graphic Design',
  'Data Analysis',
  'Data Visualization',
  'Machine Learning',
  'Artificial Intelligence',
  'Digital Marketing',
  'Content Writing',
  'Technical Writing',
  'SEO',
  'Cybersecurity',
  'Database Management',
  'SQL',
  'Mobile App Development',
  'Cloud Computing',
  'DevOps',
  'Project Management',
  'Research',
  'Public Speaking',
  'Excel/Sheets',
]

/** Interests catalogue — same treatment as skills, kept next to it. */
export const INTEREST_CATALOGUE: readonly string[] = [
  'Scholarships',
  'Internships',
  'Research Opportunities',
  'Hackathons',
  'Courses',
  'Jobs',
  'Fellowships',
  'Conferences',
]

/**
 * Comparison key for a skill. Two entries that differ only by case, spacing or
 * punctuation are the same skill ("python" / "Python " / "PYTHON").
 */
export function skillKey(skill: string): string {
  return skill.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Case-insensitive de-duplication that keeps the first spelling the student
 * used, so re-ordering or re-adding never rewrites their own wording.
 */
export function dedupeSkills(skills: readonly string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const skill of skills) {
    const label = skill.trim()
    if (!label) continue
    const key = skillKey(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(label)
  }
  return unique
}

/** True when `candidate` is already in `list` under any spelling. */
export function hasSkill(list: readonly string[], candidate: string): boolean {
  const key = skillKey(candidate)
  return Boolean(key) && list.some((skill) => skillKey(skill) === key)
}

/** Add or remove one skill, always leaving a de-duplicated list behind. */
export function toggleSkillIn(list: readonly string[], skill: string): string[] {
  return hasSkill(list, skill)
    ? list.filter((item) => skillKey(item) !== skillKey(skill))
    : dedupeSkills([...list, skill])
}
