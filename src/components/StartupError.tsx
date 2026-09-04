/**
 * Trustlify Frontend — Startup Failure Panel
 *
 * Shown instead of the app when the bundle was built without required
 * environment variables. A blank page gives no clue about the cause; this does.
 */

import { SectionLabel } from '@/components/ui/Pill'

export default function StartupError({
  missing,
  detail,
}: {
  missing: string[]
  detail?: string
}) {
  return (
    <main className="min-h-screen bg-void flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg card-noir p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 rounded-full bg-danger animate-progress-pulse" />
          <span className="font-mono text-xs tracking-[0.2em] text-danger uppercase">
            Startup blocked
          </span>
        </div>

        <h1 className="font-display text-2xl text-bone mb-3">
          Trustlify could not start
        </h1>

        <p className="font-mono text-xs leading-relaxed text-soft mb-8">
          This build is missing configuration. Vite inlines{' '}
          <span className="text-bone">VITE_*</span> values into the JavaScript
          while the build runs, so they have to exist in the build environment —
          adding them to the running app is not enough.
        </p>

        {missing.length > 0 && (
          <>
            <SectionLabel>Missing variables</SectionLabel>
            <ul className="flex flex-col gap-2 mb-8">
              {missing.map((name) => (
                <li
                  key={name}
                  className="font-mono text-xs text-bone px-3 py-2 rounded-lg bg-surface-2 border border-danger/30"
                >
                  {name}
                </li>
              ))}
            </ul>
          </>
        )}

        {detail && (
          <p className="font-mono text-xs leading-relaxed text-dim mb-8 break-words">
            {detail}
          </p>
        )}

        <p className="font-mono text-xs leading-relaxed text-dim border-t border-white/[0.06] pt-6">
          Set these in the deployment project's build environment, then trigger a
          new deploy — the files already published cannot be repaired by
          restarting it.
        </p>
      </div>
    </main>
  )
}
