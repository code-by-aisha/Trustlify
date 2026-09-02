import { useMemo, useState } from 'react'
import {
  dedupeSkills,
  hasSkill,
  skillKey,
  toggleSkillIn,
} from '@/data/skillCatalogue'

/**
 * SkillSelector — one compact chip editor for both places a student records
 * skills (onboarding step 03, Settings → Profile).
 *
 * Design constraints it has to satisfy:
 *   - the catalogue is long, so it must not cover the page with 20+ big
 *     checkboxes: suggestions live in a short scrollable, searchable strip;
 *   - selected skills must be obvious → they are pinned above the strip and
 *     stay highlighted (and removable) inside it;
 *   - a skill that is not in the catalogue must be easy to add → typing it
 *     turns the same control into an explicit "ADD" action;
 *   - "Python" and "python" are one skill → every mutation runs through the
 *     shared case-insensitive helpers in data/skillCatalogue.
 *
 * It is uncontrolled apart from `value`/`onChange`, so the caller keeps owns
 * persistence through the existing profile API.
 */
export function SkillSelector({
  value,
  onChange,
  catalogue,
  placeholder = 'Search or type your own skill…',
  addLabel = 'ADD',
  accent = 'violet',
  max = 50,
}: {
  value: string[]
  onChange: (next: string[]) => void
  catalogue: readonly string[]
  placeholder?: string
  addLabel?: string
  /** Matches the surrounding screen: violet on onboarding, lime on settings. */
  accent?: 'violet' | 'lime'
  max?: number
}) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const searching = trimmed.toLowerCase()

  // Everything typed that is not already held is a candidate custom skill.
  const isCustom = trimmed.length >= 2 && !hasSkill(value, trimmed)
  const atLimit = value.length >= max

  const suggestions = useMemo(() => {
    const pool = searching
      ? catalogue.filter((item) => item.toLowerCase().includes(searching))
      : [...catalogue]
    // Keep already-selected items visible in the strip so their state is obvious.
    return pool.sort((a, b) => Number(hasSkill(value, b)) - Number(hasSkill(value, a)))
  }, [catalogue, searching, value])

  const toggle = (skill: string) => onChange(toggleSkillIn(value, skill))
  const remove = (skill: string) => onChange(value.filter((item) => skillKey(item) !== skillKey(skill)))
  const addCustom = () => {
    if (!isCustom || atLimit) return
    onChange(dedupeSkills([...value, trimmed]))
    setQuery('')
  }

  const selectedClass =
    accent === 'lime'
      ? 'border-lime/45 bg-lime-dim text-bone'
      : 'border-violet/55 bg-[rgba(124,58,237,0.15)] text-bone'
  const accentText = accent === 'lime' ? 'text-lime' : 'text-violet'
  const addClass =
    accent === 'lime'
      ? 'border-lime/55 bg-lime-dim text-lime hover:bg-[rgba(163,255,18,0.16)]'
      : 'border-violet/60 bg-[rgba(124,58,237,0.18)] text-bone hover:bg-[rgba(124,58,237,0.28)]'

  return (
    <div>
      {/* ── Selected skills — obvious, and removable from here ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {value.length === 0 ? (
          <span className="font-mono text-[10px] text-dim">NONE SELECTED YET</span>
        ) : (
          value.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => remove(skill)}
              aria-label={`Remove ${skill}`}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs cursor-pointer transition-colors ${selectedClass}`}
            >
              <span aria-hidden="true">✓</span>
              {skill}
              <span aria-hidden="true" className="text-dim hover:text-bone">×</span>
            </button>
          ))
        )}
        <span className="font-mono text-[9px] text-dim">{value.length}/{max}</span>
      </div>

      {/* ── Search / custom entry ── */}
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (isCustom) addCustom()
            }
          }}
          placeholder={placeholder}
          aria-label="Search skills or add your own"
          className="flex-1 bg-void border border-white/[0.07] rounded-xl px-3 py-2.5 font-mono text-xs text-bone placeholder:text-dim/60 focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors"
        />
        {isCustom && (
          <button
            type="button"
            onClick={addCustom}
            disabled={atLimit}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border font-mono text-[10px] tracking-wider transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${addClass}`}
          >
            + {addLabel} “{trimmed}”
          </button>
        )}
      </div>
      {isCustom && (
        <div className={`mt-1.5 font-mono text-[9px] ${accentText}`}>
          NOT IN THE LIST — PRESS ENTER TO SAVE IT AS YOUR OWN SKILL
        </div>
      )}

      {/* ── Compact scrollable suggestion strip ── */}
      <div className="mt-3 max-h-[132px] overflow-y-auto scrollbar-hide flex flex-wrap gap-2 pr-1">
        {suggestions.length === 0 ? (
          <span className="font-mono text-[10px] text-dim">
            NO PRESET MATCHES “{trimmed}” — use the ADD button above.
          </span>
        ) : (
          suggestions.map((skill) => {
            const selected = hasSkill(value, skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggle(skill)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full border font-mono text-xs transition-all cursor-pointer ${
                  selected
                    ? selectedClass
                    : 'border-white/10 text-dim hover:border-white/25 hover:text-soft'
                }`}
              >
                {selected && <span aria-hidden="true" className="mr-1.5">✓</span>}
                {skill}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
