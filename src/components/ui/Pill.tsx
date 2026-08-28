import type { ReactNode } from 'react'

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full border border-white/10 text-soft font-mono text-xs ${className}`}>
      {children}
    </span>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-5 h-px bg-violet" />
      <span className="font-mono text-xs tracking-[0.2em] text-violet uppercase">{children}</span>
    </div>
  )
}

export function Divider() {
  return <div className="border-t border-white/[0.06]" />
}

export function RiskSignal({ level }: { level: 'low' | 'medium' | 'high' }) {
  const cfg: Record<string, { label: string; color: string; bars: boolean[] }> = {
    low: { label: 'LOW RISK', color: 'text-lime', bars: [true, false, false] },
    medium: { label: 'MEDIUM RISK', color: 'text-caution', bars: [true, true, false] },
    high: { label: 'HIGH RISK', color: 'text-danger', bars: [true, true, true] },
  }
  const { label, color, bars } = cfg[level]
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {bars.map((active, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all ${active ? (level === 'low' ? 'bg-lime' : level === 'medium' ? 'bg-caution' : 'bg-danger') : 'bg-white/15'}`}
            style={{ height: `${10 + i * 4}px` }}
          />
        ))}
      </div>
      <span className={`font-mono text-xs font-medium ${color}`}>{label}</span>
    </div>
  )
}
