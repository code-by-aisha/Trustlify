import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button, StatusBadge, SectionLabel } from "../components/ui";

const savedOpportunities = [
  { id: "1", title: "HEC Research Fellowship 2025", org: "Higher Education Commission", verdict: "verified" as const, deadline: "Sep 30, 2025", match: "STRONG MATCH", matchColor: "text-[#A3FF12]", lastChecked: "2h ago" },
  { id: "2", title: "Google Summer of Code 2025", org: "Google Open Source", verdict: "conflict" as const, deadline: "Apr 2, 2025", match: "LIKELY MATCH", matchColor: "text-[#F5B942]", lastChecked: "Yesterday" },
  { id: "3", title: "LUMS MBA Fellowship", org: "LUMS", verdict: "verified" as const, deadline: "Oct 15, 2025", match: "PARTIAL MATCH", matchColor: "text-[#A1A1AA]", lastChecked: "3d ago" },
];

const recentInvestigations = [
  { date: "Aug 22", title: "Suspicious scholarship on Instagram", verdict: "VERIFY BEFORE APPLYING", color: "text-[#F5B942]", status: "conflict" as const },
  { date: "Aug 20", title: "LUMS MBA Fellowship link", verdict: "LIKELY LEGITIMATE", color: "text-[#A3FF12]", status: "verified" as const },
  { date: "Aug 18", title: "WhatsApp forwarded internship", verdict: "HIGH RISK", color: "text-[#FF4D5E]", status: "risk" as const },
  { date: "Aug 15", title: "HEC Scholarship portal", verdict: "LEGITIMATE", color: "text-[#A3FF12]", status: "verified" as const },
];

const profileFields = [
  { label: "Education", complete: true },
  { label: "Location", complete: true },
  { label: "Skills", complete: true },
  { label: "Experience", complete: false },
  { label: "Interests", complete: true },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const completeness = Math.round((profileFields.filter(f => f.complete).length / profileFields.length) * 100);

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-10">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
            <div>
              <div className="font-mono text-xs text-[#52525B] tracking-wider mb-1">
                {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </div>
              <h1 className="font-display" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 300 }}>
                Good afternoon, <span className="text-[#A3FF12]">Ahmad</span>
              </h1>
            </div>
            <Button variant="lime" size="lg" onClick={() => navigate("/investigate")}>
              + NEW INVESTIGATION
            </Button>
          </div>

          {/* Grid layout */}
          <div className="grid grid-cols-12 gap-5">

            {/* Active Investigation */}
            <div className="col-span-12 lg:col-span-8 card-noir-violet p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-xs text-[#7C3AED] tracking-wider">ACTIVE INVESTIGATION</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-progress-pulse" />
                  <span className="font-mono text-[10px] text-[#7C3AED]">IN PROGRESS</span>
                </div>
              </div>
              <div className="font-display text-xl mb-1" style={{ fontWeight: 300 }}>
                "HEC Undergraduate Research Award 2025"
              </div>
              <div className="font-mono text-xs text-[#52525B] mb-5">Investigating since 2 minutes ago · DEMO INVESTIGATION</div>

              {/* Progress steps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                {[
                  { label: "Reading input", done: true },
                  { label: "Extracting claims", done: true },
                  { label: "Finding sources", done: true },
                  { label: "Comparing evidence", active: true },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg px-3 py-2 border font-mono text-[10px] flex items-center gap-1.5 ${
                    s.done ? "border-[rgba(163,255,18,0.2)] text-[#A3FF12] bg-[rgba(163,255,18,0.05)]"
                    : s.active ? "border-[rgba(124,58,237,0.4)] text-[#7C3AED] bg-[rgba(124,58,237,0.08)] animate-progress-pulse"
                    : "border-white/[0.06] text-[#52525B]"
                  }`}>
                    <span>{s.done ? "✓" : s.active ? "●" : "○"}</span>
                    {s.label}
                  </div>
                ))}
              </div>

              <Button variant="violet" size="sm" onClick={() => navigate("/investigation/demo/evidence")}>
                VIEW IN PROGRESS →
              </Button>
            </div>

            {/* Quick Investigate */}
            <div className="col-span-12 lg:col-span-4 card-noir p-6">
              <div className="font-mono text-xs text-[#A1A1AA] tracking-wider mb-4">QUICK INVESTIGATE</div>
              <div className="space-y-2">
                {[
                  { label: "PASTE LINK", icon: "🔗", desc: "URL or website" },
                  { label: "PASTE TEXT", icon: "📋", desc: "Post, message, claim" },
                  { label: "UPLOAD IMAGE", icon: "🖼", desc: "Screenshot, PDF" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate("/investigate")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer text-left group"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <div className="font-mono text-xs font-medium text-[#F8F9FA]">{item.label}</div>
                      <div className="font-mono text-[10px] text-[#52525B]">{item.desc}</div>
                    </div>
                    <span className="ml-auto text-[#52525B] group-hover:text-[#A1A1AA] text-xs">→</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Opportunities */}
            <div className="col-span-12 lg:col-span-8">
              <SectionLabel>SAVED OPPORTUNITIES</SectionLabel>
              <div className="space-y-3">
                {savedOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="card-noir p-5 hover:border-white/15 transition-all cursor-pointer group"
                    onClick={() => navigate(`/investigation/${opp.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium text-[#F8F9FA] mb-0.5 truncate">{opp.title}</div>
                        <div className="font-mono text-[10px] text-[#52525B]">{opp.org}</div>
                      </div>
                      <StatusBadge status={opp.verdict} />
                    </div>
                    <div className="mt-3 flex items-center flex-wrap gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[#52525B]">DEADLINE</span>
                        <span className="font-mono text-[10px] text-[#A1A1AA]">{opp.deadline}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[#52525B]">MATCH</span>
                        <span className={`font-mono text-[10px] font-medium ${opp.matchColor}`}>{opp.match}</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="font-mono text-[10px] text-[#52525B]">Last checked {opp.lastChecked}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-4 space-y-5">

              {/* Profile Match */}
              <div className="card-noir p-5">
                <div className="font-mono text-xs text-[#A1A1AA] tracking-wider mb-4">PROFILE COMPLETENESS</div>
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#A3FF12" strokeWidth="2"
                      strokeDasharray={`${completeness} ${100 - completeness}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-mono text-sm font-semibold text-[#A3FF12]">{completeness}%</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {profileFields.map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[#52525B]">{f.label}</span>
                      <span className={`font-mono text-[10px] ${f.complete ? "text-[#A3FF12]" : "text-[#F5B942]"}`}>
                        {f.complete ? "✓" : "?"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/settings")}
                  className="mt-4 w-full font-mono text-[10px] text-[#7C3AED] hover:text-[#A855F7] transition-colors cursor-pointer"
                >
                  COMPLETE PROFILE →
                </button>
              </div>

              {/* Monitoring */}
              <div className="card-noir p-5">
                <div className="font-mono text-xs text-[#A1A1AA] tracking-wider mb-3">MONITORING</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-3xl" style={{ fontWeight: 300 }}>3</span>
                  <span className="font-mono text-xs text-[#52525B]">opportunities</span>
                </div>
                <div className="font-mono text-[10px] text-[#52525B] mb-4">Currently being monitored for changes</div>
                <div className="p-3 rounded-xl bg-[rgba(245,185,66,0.06)] border border-[rgba(245,185,66,0.15)]">
                  <div className="font-mono text-[10px] text-[#F5B942] mb-1">⚡ RECENT CHANGE DETECTED</div>
                  <div className="font-mono text-[10px] text-[#A1A1AA]">GSoC 2025 deadline updated</div>
                  <div className="font-mono text-[10px] text-[#52525B]">Aug 15 → Aug 30 · Official announcement</div>
                </div>
                <button onClick={() => navigate("/monitoring")} className="mt-3 font-mono text-[10px] text-[#7C3AED] hover:text-[#A855F7] cursor-pointer">
                  VIEW MONITORING →
                </button>
              </div>
            </div>

            {/* Recent Investigations */}
            <div className="col-span-12">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>RECENT INVESTIGATIONS</SectionLabel>
                <button onClick={() => navigate("/history")} className="font-mono text-[10px] text-[#7C3AED] hover:text-[#A855F7] cursor-pointer">
                  VIEW ALL →
                </button>
              </div>
              <div className="card-noir overflow-hidden">
                {recentInvestigations.map((inv, i) => (
                  <div
                    key={inv.title}
                    onClick={() => navigate("/investigation/demo")}
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-all ${i < recentInvestigations.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                  >
                    <span className="font-mono text-[10px] text-[#52525B] w-16 flex-shrink-0">{inv.date}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-[#F8F9FA] truncate">{inv.title}</div>
                    </div>
                    <span className={`font-mono text-[10px] font-medium hidden sm:block ${inv.color}`}>{inv.verdict}</span>
                    <StatusBadge status={inv.status} />
                    <button className="font-mono text-[10px] text-[#52525B] hover:text-[#7C3AED] ml-2 hidden md:block">VIEW EVIDENCE →</button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
