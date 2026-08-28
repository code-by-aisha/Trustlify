import type { BadgeStatus } from '@/types'

interface StatusBadgeProps {
  status: BadgeStatus
  label?: string
}

const config: Record<BadgeStatus, { color: string; icon: string; defaultLabel: string }> = {
  verified: { color: 'text-lime bg-[rgba(163,255,18,0.1)] border-[rgba(163,255,18,0.25)]', icon: '✓', defaultLabel: 'VERIFIED' },
  conflict: { color: 'text-caution bg-[rgba(245,185,66,0.1)] border-[rgba(245,185,66,0.25)]', icon: '⚠', defaultLabel: 'CONFLICT' },
  risk: { color: 'text-danger bg-[rgba(255,77,94,0.1)] border-[rgba(255,77,94,0.25)]', icon: '!', defaultLabel: 'HIGH RISK' },
  pending: { color: 'text-soft bg-[rgba(161,161,170,0.08)] border-[rgba(161,161,170,0.15)]', icon: '○', defaultLabel: 'PENDING' },
  neutral: { color: 'text-soft bg-[rgba(161,161,170,0.08)] border-[rgba(161,161,170,0.15)]', icon: '–', defaultLabel: 'NEUTRAL' },
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = config[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium border ${cfg.color}`}>
      <span>{cfg.icon}</span>
      <span>{label || cfg.defaultLabel}</span>
    </span>
  )
}
