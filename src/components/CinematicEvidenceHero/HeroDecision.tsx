import { motion, useTransform } from 'framer-motion'
import type { HeroPointerValues } from './HeroPointerController'
import type { HeroScrollValues } from './HeroScrollController'

export function HeroDecision({ values, pointer }: { values: HeroScrollValues; pointer: HeroPointerValues }) {
  const scale = useTransform(values.raw, [0.89, 0.96, 1], [0.86, 1, 0.98])
  const y = useTransform(values.raw, [0.89, 0.97, 1], [80, 0, -18])
  const progressWidth = useTransform(values.raw, [0.93, 0.99], ['0%', '62%'])

  return (
    <motion.div
      className="absolute bottom-[5%] right-[5%] z-40 hidden w-[300px] xl:w-[350px] rounded-[26px] border border-lime/25 bg-[linear-gradient(145deg,rgba(17,17,24,0.9),rgba(10,10,15,0.82))] p-5 xl:p-6 shadow-[0_0_80px_rgba(163,255,18,0.14)] backdrop-blur-xl lg:block"
      style={{ opacity: values.decisionOpacity, scale, y, x: pointer.fgX }}
      aria-hidden="true"
    >
      <div className="mb-5 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-lime/35 bg-lime-dim text-3xl text-lime shadow-[0_0_36px_rgba(163,255,18,0.2)]">✓</div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.2em] text-violet">TRUSTLIFY DECISION</div>
          <div className="mt-1 font-mono text-lg font-bold leading-tight text-lime">VERIFY BEFORE APPLYING</div>
        </div>
      </div>
      <div className="mb-3 flex items-end gap-2">
        <span className="font-display text-5xl text-bone" style={{ fontWeight: 300 }}>62</span>
        <span className="pb-2 font-mono text-sm text-dim">/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-lime via-lime to-caution" style={{ width: progressWidth }} />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-dim">
        <span>Evidence Strength</span>
        <span className="text-caution">Moderate</span>
      </div>
      <p className="mt-4 border-t border-white/[0.06] pt-4 font-mono text-[11px] leading-relaxed text-soft">
        One deadline conflict remains. Open the official source directly before submitting any personal information.
      </p>
    </motion.div>
  )
}
