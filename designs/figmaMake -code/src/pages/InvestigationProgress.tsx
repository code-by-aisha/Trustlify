import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui";

const stages = [
  { id: "read", label: "Reading input", desc: "Parsing URL structure, headers, and content signals" },
  { id: "extract", label: "Extracting claims", desc: "3 key claims identified" },
  { id: "sources", label: "Finding sources", desc: "7 relevant sources located" },
  { id: "compare", label: "Comparing evidence", desc: "Cross-referencing official and independent sources" },
  { id: "current", label: "Checking currentness", desc: "Verifying deadline and status against current records" },
  { id: "risk", label: "Checking risk", desc: "Domain analysis and red flag detection" },
  { id: "profile", label: "Matching profile", desc: "Comparing against your student profile" },
  { id: "conclude", label: "Verifying conclusions", desc: "Assembling final verdict" },
];

type StageStatus = "done" | "active" | "pending" | "conflict";

export default function InvestigationProgress() {
  const navigate = useNavigate();
  const [currentStage, setCurrentStage] = useState(3);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (currentStage >= stages.length) {
      setDone(true);
      return;
    }
    const timer = setTimeout(() => setCurrentStage(s => s + 1), 900);
    return () => clearTimeout(timer);
  }, [currentStage]);

  const getStatus = (i: number): StageStatus => {
    if (i < currentStage) return i === 4 ? "conflict" : "done";
    if (i === currentStage) return "active";
    return "pending";
  };

  const statusConfig: Record<StageStatus, { color: string; icon: string; bg: string; border: string }> = {
    done: { color: "text-[#A3FF12]", icon: "✓", bg: "bg-[rgba(163,255,18,0.1)]", border: "border-[rgba(163,255,18,0.25)]" },
    active: { color: "text-[#7C3AED]", icon: "●", bg: "bg-[rgba(124,58,237,0.1)]", border: "border-[rgba(124,58,237,0.4)]" },
    pending: { color: "text-[#52525B]", icon: "○", bg: "bg-transparent", border: "border-white/[0.06]" },
    conflict: { color: "text-[#F5B942]", icon: "⚠", bg: "bg-[rgba(245,185,66,0.08)]", border: "border-[rgba(245,185,66,0.25)]" },
  };

  return (
    <AppShell>
      <div className="pt-16 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-lg py-20">
          <div className="text-center mb-12">
            <div className="font-mono text-[10px] text-[#52525B] tracking-wider mb-2">DEMO INVESTIGATION · ID #T-2408-0042</div>
            <h1 className="font-display mb-3" style={{ fontSize: 36, fontWeight: 300 }}>
              {done ? "Investigation Complete" : "Investigating..."}
            </h1>
            <div className="font-mono text-xs text-[#52525B] max-w-sm mx-auto">
              "apply-scholarship.com/fund2025 — Fully Funded Scholarship 2025"
            </div>
          </div>

          {/* Stages */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-5 bottom-5 w-px" style={{ background: "linear-gradient(to bottom, rgba(124,58,237,0.5), rgba(163,255,18,0.3))" }} />

            <div className="space-y-3">
              {stages.map((stage, i) => {
                const status = getStatus(i);
                const cfg = statusConfig[status];
                return (
                  <div key={stage.id} className={`flex items-start gap-5 p-4 rounded-xl border transition-all duration-500 ${cfg.bg} ${cfg.border}`}>
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ring-4 ring-[#0A0A0F] transition-all ${
                      status === "done" ? "bg-[#A3FF12]"
                      : status === "active" ? "bg-[#7C3AED] animate-progress-pulse"
                      : status === "conflict" ? "bg-[#F5B942]"
                      : "bg-[#52525B]/40"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-medium ${cfg.color}`}>{stage.label}</span>
                        {status === "active" && (
                          <span className="font-mono text-[9px] text-[#7C3AED] animate-progress-pulse">RUNNING</span>
                        )}
                      </div>
                      {(status === "done" || status === "conflict" || status === "active") && (
                        <div className="font-mono text-[10px] text-[#52525B] mt-0.5">{stage.desc}</div>
                      )}
                    </div>
                    <span className={`font-mono text-sm flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conflict callout */}
          {currentStage > 4 && (
            <div className="mt-6 p-4 rounded-xl border border-[rgba(245,185,66,0.3)] bg-[rgba(245,185,66,0.05)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#F5B942] text-xs">⚠</span>
                <span className="font-mono text-xs text-[#F5B942]">CONFLICT DETECTED</span>
              </div>
              <p className="font-mono text-[10px] text-[#A1A1AA]">
                The deadline shown in the circulating post (Aug 15) conflicts with the official source (Aug 25). This will be flagged in the evidence report.
              </p>
            </div>
          )}

          {done && (
            <div className="mt-8 text-center animate-fade-up">
              <div className="font-mono text-[10px] text-[#A3FF12] tracking-wider mb-4">INVESTIGATION COMPLETE · 8 stages · 0:18 elapsed</div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="lime" size="lg" onClick={() => navigate("/investigation/demo")}>
                  VIEW RESULTS →
                </Button>
                <Button variant="outline" onClick={() => navigate("/investigation/demo/evidence")}>
                  EVIDENCE GRAPH
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
