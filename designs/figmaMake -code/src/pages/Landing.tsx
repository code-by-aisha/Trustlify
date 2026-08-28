import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { MarketingHeader } from "../components/AppShell";
import { Button, StatusBadge, SectionLabel } from "../components/ui";

// ── Hero Evidence Fragments ───────────────────────────────────────────────────
function InstagramFragment() {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-3 w-52 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F5B942] to-[#FF4D5E] flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">IG</span>
        </div>
        <span className="font-mono text-[10px] text-[#A1A1AA]">scholarship_hub</span>
      </div>
      <div className="w-full h-16 rounded-lg bg-[#1A1025] flex items-center justify-center mb-2">
        <span className="font-mono text-[10px] text-[#52525B] text-center px-2">🎓 Fully Funded Scholarship 2025! Apply now...</span>
      </div>
      <div className="font-mono text-[9px] text-[#52525B]">2.4K likes · 847 comments</div>
    </div>
  );
}

function WhatsAppFragment() {
  return (
    <div className="bg-[#111118] border border-white/10 rounded-2xl p-3 w-48 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#25D366]/20 flex items-center justify-center">
          <span className="text-[8px]">💬</span>
        </div>
        <span className="font-mono text-[10px] text-[#A1A1AA]">Forwarded</span>
        <div className="ml-auto">
          <span className="font-mono text-[8px] text-[#52525B]">×4</span>
        </div>
      </div>
      <div className="bg-[#1A1025] rounded-xl p-2">
        <p className="font-mono text-[10px] text-[#A1A1AA] leading-relaxed">
          "Deadline extended! Apply before Aug 30 at apply-scholarship.com"
        </p>
      </div>
    </div>
  );
}

function SuspiciousURLFragment() {
  return (
    <div className="bg-[#111118] border border-[rgba(255,77,94,0.3)] rounded-xl p-3 w-44">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[#FF4D5E] text-[10px]">⚠</span>
        <span className="font-mono text-[9px] text-[#FF4D5E]">SUSPICIOUS URL</span>
      </div>
      <div className="font-mono text-[10px] text-[#A1A1AA] break-all">apply-scholarship.com/fund2025</div>
      <div className="mt-1.5 font-mono text-[9px] text-[#52525B]">Registered 3 days ago</div>
    </div>
  );
}

function ClaimNode() {
  return (
    <div className="bg-[#1A1025] border border-[rgba(124,58,237,0.5)] rounded-2xl p-4 w-56 shadow-[0_0_24px_rgba(124,58,237,0.2)]">
      <div className="font-mono text-[9px] text-[#7C3AED] mb-1.5 tracking-wider">CLAIM</div>
      <div className="font-display text-sm text-[#F8F9FA] leading-snug">
        "Fully Funded Scholarship 2025 is open for applications"
      </div>
    </div>
  );
}

function SourceNode({ title, domain, status }: { title: string; domain: string; status: "verified" | "conflict" }) {
  return (
    <div className={`bg-[#111118] rounded-xl p-3 w-44 border ${status === "verified" ? "border-[rgba(163,255,18,0.2)]" : "border-[rgba(245,185,66,0.2)]"}`}>
      <div className="font-mono text-[9px] text-[#52525B] mb-1">SOURCE</div>
      <div className="font-mono text-[11px] text-[#F8F9FA] mb-0.5">{title}</div>
      <div className="font-mono text-[9px] text-[#52525B]">{domain}</div>
      <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] ${
        status === "verified"
          ? "text-[#A3FF12] bg-[rgba(163,255,18,0.1)]"
          : "text-[#F5B942] bg-[rgba(245,185,66,0.1)]"
      }`}>
        {status === "verified" ? "✓ VERIFIED" : "⚠ CONFLICTING"}
      </div>
    </div>
  );
}

function VerdictFragment() {
  return (
    <div className="bg-[#111118] border border-[rgba(163,255,18,0.3)] rounded-2xl p-4 w-56 shadow-[0_0_32px_rgba(163,255,18,0.15)]">
      <div className="font-mono text-[9px] text-[#A1A1AA] mb-1 tracking-wider">TRUSTLIFY VERDICT</div>
      <div className="font-mono text-sm font-semibold text-[#A3FF12] mb-2">VERIFY BEFORE APPLYING</div>
      <div className="font-mono text-[10px] text-[#52525B] mb-2">Evidence strength</div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="font-display text-2xl text-[#F8F9FA]">62</span>
        <span className="font-mono text-[10px] text-[#52525B]">/100</span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full">
        <div className="h-full bg-[#A3FF12] rounded-full" style={{ width: "62%" }} />
      </div>
      <div className="mt-3 space-y-1">
        {[
          { label: "Official source", status: "✓", color: "text-[#A3FF12]" },
          { label: "Independent confirmed", status: "✓", color: "text-[#A3FF12]" },
          { label: "Deadline conflict", status: "⚠", color: "text-[#F5B942]" },
          { label: "Domain mismatch", status: "!", color: "text-[#FF4D5E]" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`font-mono text-[10px] font-bold ${item.color}`}>{item.status}</span>
            <span className="font-mono text-[9px] text-[#A1A1AA]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection({ navigate }: { navigate: (path: string) => void }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const parallax = (speed: number) => ({ transform: `translateY(${scrollY * speed}px)` });

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse 80% 60% at 70% 50%, rgba(124,58,237,0.15) 0%, transparent 70%)" }}
        />
        {/* Particle dots */}
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float-slow"
            style={{
              width: Math.random() > 0.7 ? "3px" : "1.5px",
              height: Math.random() > 0.7 ? "3px" : "1.5px",
              background: i % 5 === 0 ? "#A3FF12" : i % 3 === 0 ? "#7C3AED" : "rgba(255,255,255,0.3)",
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 10) % 100}%`,
              animationDelay: `${(i * 0.3) % 8}s`,
              animationDuration: `${6 + (i % 4) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={parallax(0.05)}>
        <line x1="50%" y1="45%" x2="62%" y2="42%" stroke="#7C3AED" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="62%" y1="42%" x2="72%" y2="38%" stroke="#7C3AED" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="50%" y1="45%" x2="62%" y2="55%" stroke="#7C3AED" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="72%" y1="38%" x2="82%" y2="45%" stroke="#A3FF12" strokeWidth="0.7" />
        <circle cx="50%" cy="45%" r="4" fill="rgba(124,58,237,0.5)" />
        <circle cx="82%" cy="45%" r="4" fill="rgba(163,255,18,0.5)" />
      </svg>

      <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-24">
        {/* Left: Copy */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-8 bg-[#7C3AED]" />
            <span className="font-mono text-xs tracking-[0.25em] text-[#7C3AED]">INFORMATION IS EVERYWHERE.</span>
          </div>

          <h1 className="font-display leading-[0.92] mb-6" style={{ fontSize: "clamp(64px, 8vw, 112px)", fontWeight: 300 }}>
            CONFIDENCE<br />
            <span className="text-[#A3FF12]" style={{ fontStyle: "italic" }}>ISN'T.</span>
          </h1>

          <p className="font-mono text-base text-[#A1A1AA] leading-relaxed mb-10 max-w-md">
            Trustlify investigates online opportunities, links, posts, screenshots and claims against real evidence before you click, apply, pay, or share personal information.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <Button variant="lime" size="lg" onClick={() => navigate("/investigate")}>
              INVESTIGATE SOMETHING →
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/auth?mode=student")}>
              I'M A STUDENT
            </Button>
          </div>

          <p className="font-mono text-xs text-[#52525B] tracking-wider">Evidence, not guesses.</p>
        </div>

        {/* Right: Living Evidence Field */}
        <div className="relative hidden lg:block h-[600px]">
          {/* Layer 2: background fragments */}
          <div className="absolute top-8 left-0 animate-float-slow opacity-60" style={parallax(0.12)}>
            <InstagramFragment />
          </div>
          <div className="absolute top-32 left-4 animate-float-medium opacity-70" style={{ ...parallax(0.08), animationDelay: "2s" }}>
            <WhatsAppFragment />
          </div>
          <div className="absolute bottom-24 left-0 animate-float-slow opacity-65" style={{ ...parallax(0.1), animationDelay: "1s" }}>
            <SuspiciousURLFragment />
          </div>

          {/* Layer 3: Central Claim Node */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <ClaimNode />
          </div>

          {/* Layer 4: Sources */}
          <div className="absolute top-8 right-0 animate-float-slow" style={{ ...parallax(0.06), animationDelay: "0.5s" }}>
            <SourceNode title="Official Website" domain="university.edu.pk" status="verified" />
          </div>
          <div className="absolute top-44 right-4 animate-float-medium" style={{ ...parallax(0.09), animationDelay: "1.5s" }}>
            <SourceNode title="Announcement" domain="Official notice" status="verified" />
          </div>

          {/* Layer 5: Verdict */}
          <div className="absolute bottom-0 right-0 animate-float-slow" style={{ ...parallax(0.04), animationDelay: "3s" }}>
            <VerdictFragment />
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#7C3AED] to-transparent animate-pulse" />
        <span className="font-mono text-[10px] text-[#52525B] tracking-[0.2em]">SCROLL TO EXPLORE</span>
      </div>
    </section>
  );
}

// ── Problem Section ───────────────────────────────────────────────────────────
function ProblemSection() {
  const steps = ["POST", "SEARCH", "OFFICIAL WEBSITE", "ANOTHER SOURCE", "DEADLINE", "ELIGIBILITY", "REVIEWS", "DECISION"];

  return (
    <section id="problem" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <SectionLabel>THE PROBLEM</SectionLabel>
            <h2 className="font-display leading-tight mb-6" style={{ fontSize: "clamp(36px,4vw,60px)", fontWeight: 300 }}>
              SEEING INFORMATION<br />IS EASY.<br />
              <span className="text-[#A1A1AA]">KNOWING WHAT TO TRUST ISN'T.</span>
            </h2>
            <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">
              Every day, students and general users encounter dozens of opportunities, links, and claims online. Verifying them manually is fragmented, time-consuming, and unreliable.
            </p>
          </div>

          {/* Fragmented journey visual */}
          <div className="relative">
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2 h-2 rounded-full border flex-shrink-0"
                      style={{
                        borderColor: i === steps.length - 1 ? "#A3FF12" : i > 4 ? "#F5B942" : "rgba(255,255,255,0.2)",
                        background: i === steps.length - 1 ? "#A3FF12" : "transparent",
                      }}
                    />
                    {i < steps.length - 1 && (
                      <div
                        className="w-px flex-1 min-h-[24px]"
                        style={{
                          background: i > 4 ? "rgba(245,185,66,0.3)" : "rgba(255,255,255,0.08)",
                          marginTop: "2px",
                          marginBottom: "2px",
                        }}
                      />
                    )}
                  </div>
                  <div
                    className={`py-2 font-mono text-xs tracking-wider transition-all ${
                      i === steps.length - 1
                        ? "text-[#A3FF12]"
                        : i > 4
                        ? "text-[#F5B942] opacity-80"
                        : i > 2
                        ? "text-[#52525B]"
                        : "text-[#A1A1AA]"
                    }`}
                  >
                    {step}
                    {i > 2 && i < steps.length - 1 && (
                      <span className="ml-2 text-[9px] text-[#52525B]">
                        {i === 3 ? "conflicting?" : i === 4 ? "which one?" : i === 5 ? "am I eligible?" : "mixed reviews"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-[rgba(245,185,66,0.05)] border border-[rgba(245,185,66,0.1)] flex items-center justify-center">
              <span className="font-mono text-[10px] text-[#F5B942] text-center leading-tight">MANUAL<br />PROCESS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const stages = [
    { num: "01", title: "UNDERSTAND", desc: "Trustlify reads your input — a link, text, screenshot, or PDF — and identifies what it contains.", icon: "◎" },
    { num: "02", title: "INVESTIGATE", desc: "Claims are extracted and cross-referenced against official, independent, and public sources.", icon: "⊹" },
    { num: "03", title: "COMPARE", desc: "Sources are ranked by authority and compared for consistency. Conflicts are highlighted.", icon: "⇄" },
    { num: "04", title: "VERIFY", desc: "Evidence relationships are mapped. Facts are separated from interpretations explicitly.", icon: "✓" },
    { num: "05", title: "DECIDE", desc: "A clear verdict is issued with actionable next steps. Evidence remains accessible.", icon: "→" },
  ];

  return (
    <section id="how-it-works" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel>HOW TRUSTLIFY WORKS</SectionLabel>
        <h2 className="font-display mb-16" style={{ fontSize: "clamp(36px,4vw,60px)", fontWeight: 300 }}>
          FIVE STAGES.<br />
          <span className="text-[#A1A1AA]">ONE COHERENT INVESTIGATION.</span>
        </h2>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-10 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.4)] to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {stages.map((stage, i) => (
              <div key={stage.num} className="relative group">
                {/* Node */}
                <div className="relative flex flex-col items-center lg:items-start">
                  <div className="w-10 h-10 rounded-full border border-[rgba(124,58,237,0.5)] bg-[#0A0A0F] flex items-center justify-center mb-6 group-hover:border-[#7C3AED] transition-all group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                    <span className="font-mono text-sm text-[#7C3AED]">{stage.icon}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#52525B] mb-1 tracking-wider">{stage.num}</div>
                  <div className="font-mono text-sm font-semibold text-[#F8F9FA] mb-3">{stage.title}</div>
                  <p className="font-mono text-xs text-[#52525B] leading-relaxed text-center lg:text-left">{stage.desc}</p>
                </div>
                {/* Connector arrow */}
                {i < stages.length - 1 && (
                  <div className="hidden lg:block absolute top-4 -right-3 text-[rgba(124,58,237,0.4)] text-xs z-10">›</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Evidence Engine ───────────────────────────────────────────────────────────
function EvidenceEngine() {
  const chain = [
    { label: "CLAIM", color: "border-[rgba(124,58,237,0.5)] text-[#7C3AED]", bg: "bg-[rgba(124,58,237,0.08)]" },
    { label: "OFFICIAL SOURCE", color: "border-[rgba(163,255,18,0.4)] text-[#A3FF12]", bg: "bg-[rgba(163,255,18,0.05)]" },
    { label: "INDEPENDENT SOURCE", color: "border-[rgba(163,255,18,0.3)] text-[#A3FF12]", bg: "bg-[rgba(163,255,18,0.04)]" },
    { label: "PUBLIC EVIDENCE", color: "border-[rgba(245,185,66,0.4)] text-[#F5B942]", bg: "bg-[rgba(245,185,66,0.05)]" },
    { label: "VERIFICATION", color: "border-[rgba(163,255,18,0.6)] text-[#A3FF12]", bg: "bg-[rgba(163,255,18,0.08)]" },
  ];

  return (
    <section id="evidence-engine" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
          <div>
            <SectionLabel>EVIDENCE ENGINE</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
              AI DOESN'T BECOME<br />
              <span className="text-[#A1A1AA]">THE SOURCE OF TRUTH.</span>
            </h2>
            <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed mb-8">
              Trustlify sources every claim against verifiable evidence. The AI reasons over what the evidence shows — it never invents it.
            </p>

            {/* Chain */}
            <div className="space-y-2">
              {chain.map((item, i) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`flex-1 px-4 py-3 rounded-xl border font-mono text-xs tracking-wider ${item.color} ${item.bg}`}>
                    {item.label}
                  </div>
                  {i < chain.length - 1 && (
                    <div className="text-[#52525B] font-mono text-xs">↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fact vs Interpretation */}
          <div className="space-y-4">
            <div className="font-mono text-xs text-[#52525B] tracking-wider mb-6">FACT VS INTERPRETATION</div>
            <div className="card-noir p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#A3FF12]" />
                <span className="font-mono text-xs tracking-wider text-[#A3FF12]">FACT</span>
              </div>
              <p className="font-display text-base text-[#F8F9FA] leading-relaxed">
                "The official site lists the application deadline as August 25, 2025."
              </p>
              <div className="mt-3 font-mono text-[10px] text-[#52525B]">Source: university.edu.pk · Retrieved Aug 22, 2025</div>
            </div>
            <div className="card-noir p-6 border-[rgba(124,58,237,0.2)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                <span className="font-mono text-xs tracking-wider text-[#7C3AED]">INTERPRETATION</span>
              </div>
              <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">
                The circulating post lists August 15 as the deadline. This conflicts with the official source and may reflect an outdated or incorrect version of the opportunity.
              </p>
            </div>
            <div className="card-noir p-4 border-[rgba(245,185,66,0.2)]">
              <div className="flex items-center gap-2">
                <span className="text-[#F5B942] text-xs">⚠</span>
                <span className="font-mono text-xs text-[#F5B942]">DEADLINE CONFLICT DETECTED</span>
              </div>
              <p className="font-mono text-[11px] text-[#52525B] mt-1.5">Post shows Aug 15. Official source shows Aug 25. Verify before acting.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Student Intelligence ──────────────────────────────────────────────────────
function StudentIntelligence() {
  const matchFields = [
    { label: "Education", status: "✓", color: "text-[#A3FF12]", note: "BS Computer Science" },
    { label: "Location", status: "✓", color: "text-[#A3FF12]", note: "Pakistan" },
    { label: "Skills", status: "✓", color: "text-[#A3FF12]", note: "Python, Research" },
    { label: "Experience", status: "?", color: "text-[#F5B942]", note: "Not listed in opportunity" },
    { label: "Relevance", status: "✓", color: "text-[#A3FF12]", note: "STEM field match" },
  ];

  return (
    <section id="for-students" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Student Match Card */}
          <div className="card-noir-violet p-8 max-w-sm">
            <div className="font-mono text-[10px] tracking-widest text-[#52525B] mb-4">DEMO — STUDENT PROFILE MATCH</div>
            <div className="font-mono text-xs text-[#7C3AED] mb-6 tracking-wider">YOUR MATCH</div>
            <div className="space-y-3 mb-6">
              {matchFields.map((field) => (
                <div key={field.label} className="flex items-center gap-3">
                  <span className={`font-mono text-sm font-bold w-4 ${field.color}`}>{field.status}</span>
                  <span className="font-mono text-xs text-[#F8F9FA] flex-1">{field.label}</span>
                  <span className="font-mono text-[10px] text-[#52525B]">{field.note}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <div className="font-mono text-[10px] text-[#52525B] mb-1">MATCH STRENGTH</div>
              <div className="font-mono text-lg font-semibold text-[#A3FF12]">LIKELY MATCH</div>
              <p className="font-mono text-[10px] text-[#52525B] mt-2 leading-relaxed">
                You appear likely to meet the listed requirements based on the available information.
              </p>
            </div>
          </div>

          <div>
            <SectionLabel>STUDENT INTELLIGENCE</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
              NOT ONLY "IS IT REAL?"<br />
              <span className="text-[#A1A1AA]">ALSO "DOES IT FIT ME?"</span>
            </h2>
            <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">
              Trustlify cross-references your student profile against the opportunity's actual requirements — giving you a nuanced match assessment, not just a binary yes/no.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Currentness ───────────────────────────────────────────────────────────────
function Currentness() {
  const timeline = [
    { label: "Published", date: "Mar 2024", note: "Original post", color: "bg-[#52525B]" },
    { label: "Updated", date: "Jul 2024", note: "Deadline extended", color: "bg-[#7C3AED]" },
    { label: "Deadline", date: "Aug 25, 2024", note: "Current official", color: "bg-[#A3FF12]" },
    { label: "Current Status", date: "Aug 22, 2025", note: "EXPIRED", color: "bg-[#FF4D5E]" },
  ];

  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel>CURRENTNESS</SectionLabel>
        <h2 className="font-display mb-16" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
          REAL ONCE DOESN'T MEAN<br />
          <span className="text-[#A1A1AA]">CURRENT NOW.</span>
        </h2>

        <div className="max-w-3xl">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-[rgba(124,58,237,0.4)] via-[rgba(124,58,237,0.2)] to-[rgba(255,77,94,0.4)]" />
            <div className="space-y-6">
              {timeline.map((item, i) => (
                <div key={item.label} className="flex items-start gap-6">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${item.color} ring-4 ring-[#0A0A0F]`} />
                  <div className="flex-1 card-noir p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm text-[#F8F9FA]">{item.label}</span>
                      <span className="font-mono text-xs text-[#52525B]">{item.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#A1A1AA]">{item.note}</span>
                      {i === timeline.length - 1 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(255,77,94,0.1)] border border-[rgba(255,77,94,0.3)] font-mono text-[9px] text-[#FF4D5E]">
                          ⚠ EXPIRED OPPORTUNITY
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 card-noir border-[rgba(163,255,18,0.15)] p-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-[#A3FF12] rounded-full flex-shrink-0" />
              <div>
                <div className="font-mono text-xs text-[#A3FF12] mb-0.5">GENUINE SOURCE · EXPIRED OPPORTUNITY</div>
                <div className="font-mono text-[11px] text-[#52525B]">The organization is legitimate but this specific opportunity closed in 2024. Trustlify flags this discrepancy before you apply.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Privacy ───────────────────────────────────────────────────────────────────
function Privacy() {
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <SectionLabel>PRIVACY</SectionLabel>
            <h2 className="font-display mb-6 leading-tight" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
              VERIFY WITHOUT EXPOSING<br />
              <span className="text-[#A1A1AA]">MORE THAN YOU NEED TO.</span>
            </h2>
            <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">
              When you upload a document for investigation, Trustlify guides you through redacting sensitive personal data before analysis begins.
            </p>
          </div>

          {/* Redact visual */}
          <div className="card-noir p-6 max-w-sm">
            <div className="font-mono text-[10px] text-[#52525B] mb-4 tracking-wider">FICTIONAL DOCUMENT PREVIEW</div>
            <div className="space-y-3">
              {[
                { label: "Full Name", value: "Ahmad Khan", redact: false },
                { label: "CNIC", value: "█████ ██████ █", redact: true },
                { label: "OTP Code", value: "████", redact: true },
                { label: "Bank Info", value: "█████████", redact: true },
                { label: "Phone", value: "+92 ██████████", redact: true },
              ].map((field) => (
                <div key={field.label} className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                  <span className="font-mono text-xs text-[#52525B]">{field.label}</span>
                  <span className={`font-mono text-xs ${field.redact ? "text-[#F5B942] tracking-widest" : "text-[#A1A1AA]"}`}>
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(163,255,18,0.08)] border border-[rgba(163,255,18,0.15)]">
              <span className="text-[#A3FF12] text-xs">✓</span>
              <span className="font-mono text-[11px] text-[#A3FF12]">REDACT BEFORE ANALYSIS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Local Context ─────────────────────────────────────────────────────────────
function LocalContext() {
  const languages = [
    { lang: "English", example: "Is this scholarship genuine?", active: true },
    { lang: "Urdu", example: "کیا یہ اسکالرشپ اصلی ہے؟", active: true },
    { lang: "Roman Urdu", example: "Ye scholarship genuine hai? deadline kya hai?", active: true },
    { lang: "Sindhi*", example: "ڇا هي اسڪالرشپ اصلي آهي؟", active: false },
  ];

  return (
    <section className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel>LOCAL CONTEXT</SectionLabel>
        <h2 className="font-display mb-16" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
          BUILT FOR HOW PEOPLE<br />
          <span className="text-[#A1A1AA]">ACTUALLY COMMUNICATE HERE.</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {languages.map((item) => (
            <div key={item.lang} className={`card-noir p-5 ${item.active ? "" : "opacity-50"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-medium text-[#F8F9FA]">{item.lang}</span>
                {item.active
                  ? <span className="w-1.5 h-1.5 rounded-full bg-[#A3FF12]" />
                  : <span className="font-mono text-[9px] text-[#52525B]">PENDING VALIDATION</span>
                }
              </div>
              <p className="font-mono text-[11px] text-[#52525B] leading-relaxed">{item.example}</p>
            </div>
          ))}
        </div>

        <div className="card-noir p-5 border-[rgba(124,58,237,0.2)] max-w-xl">
          <div className="font-mono text-[10px] text-[#52525B] mb-2">MIXED-LANGUAGE INPUT EXAMPLE</div>
          <p className="font-display text-base text-[#F8F9FA] italic">
            "Ye scholarship genuine hai? deadline kya hai?"
          </p>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status="verified" label="ROMAN URDU DETECTED" />
          </div>
        </div>
        <p className="font-mono text-[10px] text-[#52525B] mt-4">*Sindhi support will be enabled only after full model validation.</p>
      </div>
    </section>
  );
}

// ── Why Trustlify ─────────────────────────────────────────────────────────────
function WhyTrustlify() {
  const capabilities = [
    { title: "Investigate Anything", desc: "Links, posts, screenshots, PDFs, jobs, scholarships, internships, courses, hackathons.", size: "large" },
    { title: "Evidence-Driven", desc: "Every verdict is grounded in verifiable sources. AI reasons over evidence, not in place of it.", size: "medium" },
    { title: "Conflict Detection", desc: "Mismatches between claims and official sources are surfaced automatically.", size: "medium" },
    { title: "Currentness", desc: "Expired opportunities are flagged even when the original source was legitimate.", size: "small" },
    { title: "Student Match", desc: "Profile-based eligibility assessment beyond just 'is it real?'", size: "small" },
    { title: "Actionable Guidance", desc: "Clear next steps with every verdict.", size: "small" },
    { title: "Privacy First", desc: "Redact sensitive data before analysis.", size: "small" },
  ];

  return (
    <section id="why-trustlify" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <SectionLabel>WHY TRUSTLIFY</SectionLabel>
        <h2 className="font-display mb-16" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
          AN INVESTIGATION PLATFORM.<br />
          <span className="text-[#A1A1AA]">NOT ANOTHER AI CHATBOT.</span>
        </h2>

        {/* Editorial asymmetric arrangement */}
        <div className="grid grid-cols-12 gap-4">
          {/* Large feature */}
          <div className="col-span-12 lg:col-span-5 card-noir-violet p-8">
            <div className="w-10 h-10 rounded-xl bg-[rgba(124,58,237,0.2)] flex items-center justify-center mb-4">
              <span className="text-[#7C3AED] text-lg">◎</span>
            </div>
            <h3 className="font-display text-2xl mb-3" style={{ fontWeight: 300 }}>Investigate Anything</h3>
            <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">Links, posts, screenshots, PDFs, jobs, scholarships, internships, courses, hackathons, and more.</p>
          </div>

          {/* Two medium */}
          <div className="col-span-12 sm:col-span-6 lg:col-span-4 card-noir p-6">
            <div className="text-[#7C3AED] text-lg mb-3">⊹</div>
            <h3 className="font-mono text-sm font-semibold mb-2">Evidence-Driven</h3>
            <p className="font-mono text-xs text-[#52525B] leading-relaxed">Every verdict is grounded in verifiable sources. AI reasons over evidence, not in place of it.</p>
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-3 card-noir p-6">
            <div className="text-[#F5B942] text-lg mb-3">⚡</div>
            <h3 className="font-mono text-sm font-semibold mb-2">Conflict Detection</h3>
            <p className="font-mono text-xs text-[#52525B] leading-relaxed">Mismatches surfaced automatically.</p>
          </div>

          {/* Four small */}
          {[
            { icon: "◷", title: "Currentness", desc: "Expired opportunities flagged." },
            { icon: "◉", title: "Student Match", desc: "Profile eligibility assessment." },
            { icon: "→", title: "Actionable Guidance", desc: "Clear next steps every time." },
            { icon: "◻", title: "Privacy First", desc: "Redact before analysis." },
          ].map((item) => (
            <div key={item.title} className="col-span-6 lg:col-span-3 card-noir p-5">
              <div className="text-[#A1A1AA] text-base mb-2">{item.icon}</div>
              <h3 className="font-mono text-xs font-semibold mb-1">{item.title}</h3>
              <p className="font-mono text-[10px] text-[#52525B] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <section id="about" className="py-32 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-5">
            <SectionLabel>ABOUT</SectionLabel>
            <h2 className="font-display mb-6" style={{ fontSize: "clamp(32px,3.5vw,54px)", fontWeight: 300 }}>
              TRUST SHOULD BE EARNED<br />
              <span className="text-[#A1A1AA]">THROUGH EVIDENCE.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 space-y-6">
            {[
              { label: "MISSION", text: "Trustlify exists to help people — especially students navigating complex online environments — make informed decisions grounded in evidence, not guesses." },
              { label: "EVIDENCE-FIRST PHILOSOPHY", text: "We believe AI should surface and reason over evidence, not replace it. Every verdict Trustlify issues is traceable to a source you can verify yourself." },
              { label: "HOW AI IS USED", text: "The AI extracts claims, identifies relevant sources, detects conflicts, and reasons about what the evidence means. It does not fabricate information or present interpretation as fact." },
              { label: "RESPONSIBLE BOUNDARIES", text: "Trustlify states clearly when evidence is insufficient. It distinguishes facts from interpretations. It labels demo content explicitly. It does not create false certainty." },
              { label: "STUDENT IMPACT", text: "Students in Pakistan and similar contexts encounter a disproportionate volume of dubious opportunities. Trustlify is designed to close that information asymmetry." },
            ].map((item) => (
              <div key={item.label} className="border-t border-white/[0.06] pt-6">
                <div className="font-mono text-[10px] text-[#7C3AED] tracking-wider mb-2">{item.label}</div>
                <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className="py-40 border-t border-white/[0.06] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <div className="font-mono text-xs tracking-[0.25em] text-[#52525B] mb-6">SEE SOMETHING UNCERTAIN?</div>
        <h2 className="font-display mb-10 leading-none" style={{ fontSize: "clamp(64px,8vw,120px)", fontWeight: 300 }}>
          INVESTIGATE IT.
        </h2>
        <Button variant="lime" size="lg" onClick={() => navigate("/investigate")}>
          INVESTIGATE SOMETHING →
        </Button>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="#A3FF12" strokeWidth="1.2" fill="none" />
              <path d="M4.5 7L6.5 9L9.5 5.5" stroke="#A3FF12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-mono text-xs text-[#52525B]">TRUSTLIFY · Evidence-Driven Investigation</span>
        </div>
        <div className="font-mono text-[10px] text-[#52525B]">© 2025 Trustlify. Prototype only — not production software.</div>
      </div>
    </footer>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F9FA]">
      <MarketingHeader />
      <HeroSection navigate={navigate} />
      <ProblemSection />
      <HowItWorks />
      <EvidenceEngine />
      <StudentIntelligence />
      <Currentness />
      <Privacy />
      <LocalContext />
      <WhyTrustlify />
      <AboutSection />
      <FinalCTA navigate={navigate} />
      <Footer />
    </div>
  );
}
