import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui";

interface AppShellProps {
  children: ReactNode;
  variant?: "marketing" | "app";
}

export function AppShell({ children, variant = "app" }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F9FA]">
      {variant === "app" ? <AppHeader /> : null}
      <main>{children}</main>
    </div>
  );
}

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: "DASHBOARD", path: "/dashboard" },
    { label: "INVESTIGATE", path: "/investigate" },
    { label: "HISTORY", path: "/history" },
    { label: "MONITORING", path: "/monitoring" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0A0A0F]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <TrustlifyLogo />
          <span className="font-mono font-semibold text-sm tracking-wider text-[#F8F9FA]">
            TRUSTLIFY
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 font-mono text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                isActive(item.path)
                  ? "text-[#F8F9FA] bg-white/[0.06]"
                  : "text-[#A1A1AA] hover:text-[#F8F9FA] hover:bg-white/[0.04]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="hidden md:flex w-8 h-8 items-center justify-center rounded-full border border-white/10 text-[#A1A1AA] hover:text-white hover:border-white/20 transition-all cursor-pointer"
          >
            <SettingsIcon />
          </button>
          <Button variant="lime" size="sm" onClick={() => navigate("/investigate")}>
            + INVESTIGATE
          </Button>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-[#A1A1AA] cursor-pointer"
          >
            <div className="w-5 space-y-1">
              <div className="h-px bg-current transition-all" />
              <div className="h-px bg-current transition-all" />
              <div className="h-px bg-current transition-all" />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0A0A0F]/95 backdrop-blur-xl">
          <div className="p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 font-mono text-xs tracking-wider rounded-lg transition-all cursor-pointer ${
                  isActive(item.path)
                    ? "text-[#F8F9FA] bg-white/[0.06]"
                    : "text-[#A1A1AA] hover:text-[#F8F9FA]"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { navigate("/settings"); setMenuOpen(false); }}
              className="w-full text-left px-4 py-3 font-mono text-xs tracking-wider text-[#A1A1AA] hover:text-[#F8F9FA] cursor-pointer"
            >
              SETTINGS
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05]" style={{ background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)" }}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrustlifyLogo />
          <span className="font-mono font-semibold text-sm tracking-wider text-[#F8F9FA]">TRUSTLIFY</span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {["how-it-works", "evidence-engine", "for-students", "about"].map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="font-mono text-xs tracking-wider text-[#A1A1AA] hover:text-[#F8F9FA] transition-colors cursor-pointer capitalize"
            >
              {id.replace("-", " ").toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
            LOG IN
          </Button>
          <Button variant="lime" size="sm" onClick={() => navigate("/investigate")}>
            INVESTIGATE NOW
          </Button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-[#A1A1AA] cursor-pointer p-1"
          >
            <div className="w-5 space-y-1.5">
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
            </div>
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0A0A0F] px-6 py-4 space-y-3">
          {["how-it-works", "evidence-engine", "for-students", "about"].map((id) => (
            <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left font-mono text-xs tracking-wider text-[#A1A1AA] py-2 cursor-pointer">
              {id.replace("-", " ").toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function TrustlifyLogo() {
  return (
    <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center flex-shrink-0" style={{ boxShadow: "0 0 12px rgba(124,58,237,0.5)" }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="#A3FF12" strokeWidth="1.2" fill="none" />
        <path d="M4.5 7L6.5 9L9.5 5.5" stroke="#A3FF12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
