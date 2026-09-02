import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'lime' | 'violet' | 'ghost' | 'outline'
  /**
   * xs is a mobile-first size. Below 640px it is visually tighter (shorter
   * padding, 10px font) so header CTAs sit proportionally in a phone-width
   * bar; at 640px and up it renders exactly the same as `sm`, so nothing on
   * desktop changes.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export function Button({
  children,
  variant = 'lime',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // transition-all already animates background/shadow. active:scale gives a
  // one-frame press feedback without adding a motion library. focus-visible
  // ring is a11y-only — mouse users never see it, keyboard users do.
  const base =
    'inline-flex items-center gap-2 font-mono font-medium tracking-wider transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-void cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-full'

  const variants: Record<string, string> = {
    lime: 'bg-lime text-void hover:bg-[#b8ff3d] shadow-[0_0_20px_rgba(163,255,18,0.25)] hover:shadow-[0_0_32px_rgba(163,255,18,0.4)]',
    violet: 'bg-violet text-white hover:bg-[#8B4CF7] shadow-[0_0_20px_rgba(124,58,237,0.3)]',
    ghost: 'text-soft hover:text-bone border border-transparent hover:border-white/10',
    outline: 'border border-white/15 text-bone hover:border-white/30 hover:bg-white/5',
  }

  const sizes: Record<string, string> = {
    xs: 'px-3 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-xs',
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  }

  return (
    <button
      {...props}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
