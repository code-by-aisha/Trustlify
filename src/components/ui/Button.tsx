import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'lime' | 'violet' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  children,
  variant = 'lime',
  size = 'md',
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center gap-2 font-mono font-medium tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-full'

  const variants: Record<string, string> = {
    lime: 'bg-lime text-void hover:bg-[#b8ff3d] shadow-[0_0_20px_rgba(163,255,18,0.25)] hover:shadow-[0_0_32px_rgba(163,255,18,0.4)]',
    violet: 'bg-violet text-white hover:bg-[#8B4CF7] shadow-[0_0_20px_rgba(124,58,237,0.3)]',
    ghost: 'text-soft hover:text-bone border border-transparent hover:border-white/10',
    outline: 'border border-white/15 text-bone hover:border-white/30 hover:bg-white/5',
  }

  const sizes: Record<string, string> = {
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
