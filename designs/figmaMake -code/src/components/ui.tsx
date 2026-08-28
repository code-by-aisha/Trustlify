import { ReactNode } from "react";

// ── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps {
  children: ReactNode;
  variant?: "lime" | "violet" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function Button({ children, variant = "lime", size = "md", onClick, className = "", type = "button", disabled }: ButtonProps) {
  const base = "inline-flex items-center gap-2 font-mono font-medium tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-full";

  const variants = {
    lime: "bg-[#A3FF12] text-[#0A0A0F] hover:bg-[#b8ff3d] shadow-[0_0_20px_rgba(163,255,18,0.25)] hover:shadow-[0_0_32px_rgba(163,255,18,0.4)]",
    violet: "bg-[#7C3AED] text-white hover:bg-[#8B4CF7] shadow-[0_0_20px_rgba(124,58,237,0.3)]",
    ghost: "text-[#A1A1AA] hover:text-[#F8F9FA] border border-transparent hover:border-white/10",
    outline: "border border-white/15 text-[#F8F9FA] hover:border-white/30 hover:bg-white/5",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── StatusBadge ──────────────────────────────────────────────────────────────
interface StatusBadgeProps {
  status: "verified" | "conflict" | "risk" | "pending" | "neutral";
  label?: string;
}

const statusConfig = {
  verified: { color: "text-[#A3FF12] bg-[rgba(163,255,18,0.1)] border-[rgba(163,255,18,0.25)]", icon: "✓", defaultLabel: "VERIFIED" },
  conflict: { color: "text-[#F5B942] bg-[rgba(245,185,66,0.1)] border-[rgba(245,185,66,0.25)]", icon: "⚠", defaultLabel: "CONFLICT" },
  risk: { color: "text-[#FF4D5E] bg-[rgba(255,77,94,0.1)] border-[rgba(255,77,94,0.25)]", icon: "!", defaultLabel: "HIGH RISK" },
  pending: { color: "text-[#A1A1AA] bg-[rgba(161,161,170,0.08)] border-[rgba(161,161,170,0.15)]", icon: "○", defaultLabel: "PENDING" },
  neutral: { color: "text-[#A1A1AA] bg-[rgba(161,161,170,0.08)] border-[rgba(161,161,170,0.15)]", icon: "–", defaultLabel: "NEUTRAL" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium border ${cfg.color}`}>
      <span>{cfg.icon}</span>
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────────────
export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full border border-white/10 text-[#A1A1AA] font-mono text-xs ${className}`}>
      {children}
    </span>
  );
}

// ── SectionLabel ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-5 h-px bg-[#7C3AED]" />
      <span className="font-mono text-xs tracking-[0.2em] text-[#7C3AED] uppercase">{children}</span>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider() {
  return <div className="border-t border-white/[0.06]" />;
}

// ── RiskSignal ───────────────────────────────────────────────────────────────
interface RiskSignalProps {
  level: "low" | "medium" | "high";
}

export function RiskSignal({ level }: RiskSignalProps) {
  const configs = {
    low: { label: "LOW RISK", color: "text-[#A3FF12]", bars: [true, false, false] },
    medium: { label: "MEDIUM RISK", color: "text-[#F5B942]", bars: [true, true, false] },
    high: { label: "HIGH RISK", color: "text-[#FF4D5E]", bars: [true, true, true] },
  };
  const cfg = configs[level];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {cfg.bars.map((active, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all ${active ? cfg.color.replace("text-", "bg-") : "bg-white/15"}`}
            style={{ height: `${10 + i * 4}px` }}
          />
        ))}
      </div>
      <span className={`font-mono text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}
