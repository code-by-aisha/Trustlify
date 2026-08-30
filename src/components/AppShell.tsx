import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui'
import { TrustlifyLogo } from '@/components/TrustlifyLogo'
import { useAuth } from '@/hooks/useAuth'

/* ─── APP SHELL ──────────────────────────────────────────────────────────── */

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-void text-bone">
      <AppHeader />
      <main>{children}</main>
    </div>
  )
}

/* ─── APP HEADER (authenticated) ─────────────────────────────────────────── */

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { label: 'DASHBOARD', path: '/dashboard' },
    { label: 'INVESTIGATE', path: '/investigate' },
    { label: 'HISTORY', path: '/history' },
    { label: 'MONITORING', path: '/monitoring' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-void/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <TrustlifyLogo />
          <span className="font-mono font-semibold text-sm tracking-wider text-bone">TRUSTLIFY</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 font-mono text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                isActive(item.path)
                  ? 'text-bone bg-white/[0.06]'
                  : 'text-soft hover:text-bone hover:bg-white/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full border border-white/10 text-soft hover:text-white hover:border-white/20 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <Button variant="lime" size="sm" onClick={() => navigate('/investigate')}>
            + INVESTIGATE
          </Button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-soft cursor-pointer"
            aria-label="Toggle menu"
          >
            <div className="w-5 space-y-1">
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-void/95 backdrop-blur-xl">
          <div className="p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false) }}
                className={`w-full text-left px-4 py-3 font-mono text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                  isActive(item.path) ? 'text-bone bg-white/[0.06]' : 'text-soft hover:text-bone'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { navigate('/settings'); setMenuOpen(false) }}
              className="w-full text-left px-4 py-3 font-mono text-xs tracking-wider text-soft hover:text-bone cursor-pointer"
            >
              SETTINGS
            </button>
            <button
              onClick={() => { signOut(); navigate('/'); setMenuOpen(false) }}
              className="w-full text-left px-4 py-3 font-mono text-xs tracking-wider text-danger hover:text-bone cursor-pointer"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

/* ─── MARKETING HEADER ───────────────────────────────────────────────────── */

export function MarketingHeader() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navIds = ['how-it-works', 'evidence-engine', 'for-students', 'about']

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05]"
      style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(20px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 cursor-pointer shrink-0">
          <TrustlifyLogo />
          <span className="font-mono font-semibold text-sm tracking-wider text-bone">TRUSTLIFY</span>
        </button>

        {/* Desktop nav — hidden below 1024px */}
        <nav className="hidden lg:flex items-center gap-6">
          {navIds.map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="font-mono text-xs tracking-wider text-soft hover:text-bone transition-colors cursor-pointer uppercase whitespace-nowrap"
            >
              {id.replace(/-/g, ' ')}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* CTA buttons — hide secondary on very small screens */}
          <Button variant="outline" size="sm" onClick={() => navigate('/auth')} className="hidden sm:inline-flex">
            LOG IN
          </Button>
          <Button variant="lime" size="sm" onClick={() => navigate('/investigate')}>
            INVESTIGATE NOW
          </Button>
          {/* Hamburger — visible below 1024px */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden text-soft cursor-pointer p-1.5 -mr-1 rounded-lg hover:bg-white/[0.04] transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 3l12 12M15 3L3 15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5h14M2 9h14M2 13h14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile/tablet menu — slides in below 1024px */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/[0.06] bg-[rgba(10,10,15,0.97)] backdrop-blur-xl px-4 sm:px-6 py-4 space-y-1">
          {navIds.map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="block w-full text-left font-mono text-xs tracking-wider text-soft hover:text-bone py-3 px-2 rounded-lg hover:bg-white/[0.04] transition-all cursor-pointer uppercase"
            >
              {id.replace(/-/g, ' ')}
            </button>
          ))}
          <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={() => { navigate('/auth'); setMenuOpen(false) }} className="w-full justify-center">
              LOG IN
            </Button>
            <Button variant="lime" size="sm" onClick={() => { navigate('/investigate'); setMenuOpen(false) }} className="w-full justify-center">
              INVESTIGATE NOW
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
