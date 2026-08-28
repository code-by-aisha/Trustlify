import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button, StatusBadge, RiskSignal } from "../components/ui";

const checks = [
  { label: "Organization", verdict: "verified" as const, explanation: "The scholarship organization is a legitimate registered institution.", evidence: "Official registry + HEC records" },
  { label: "Opportunity", verdict: "conflict" as const, explanation: "The specific opportunity details differ between sources.", evidence: "3 conflicting sources" },
  { label: "Current Status", verdict: "conflict" as const, explanation: "Deadline conflict: post shows Aug 15, official source shows Aug 25.", evidence: "university.edu.pk" },
  { label: "Deadline", verdict: "conflict" as const, explanation: "Aug 15 (post) vs Aug 25 (official). Verify before acting.", evidence: "Official website" },
  { label: "Application Source", verdict: "risk" as const, explanation: "The linked domain (apply-scholarship.com) is not affiliated with the official institution.", evidence: "Domain registration records" },
  { label: "Risk Level", verdict: "conflict" as const, explanation: "Medium risk. Genuine organization, suspicious third-party link.", evidence: "Technical analysis" },
  { label: "Student Match", verdict: "verified" as const, explanation: "Based on your profile, you appear likely to meet the listed eligibility requirements.", evidence: "Profile comparison" },
];

const factVsInterpretation = {
  fact: "The official university website (university.edu.pk) lists the application deadline as August 25, 2025, and specifies that applications must be submitted through the official student portal.",
  interpretation: "The circulating post and link direct applicants to apply-scholarship.com — a domain registered only 15 days ago with no affiliation to the official institution. This strongly suggests the link is unauthorized and potentially harmful.",
};

export default function InvestigationResult() {
  const navigate = useNavigate();
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [tab, setTab] = useState<"checks" | "fact-interpretation">("checks");

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">

          {/* Demo label */}
          <div className="font-mono text-[10px] text-[#52525B] tracking-wider mb-6">DEMO INVESTIGATION · ID #T-2408-0042 · Aug 22, 2025</div>

          {/* Verdict hero */}
          <div className="card-noir border-[rgba(245,185,66,0.25)] p-8 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle, #F5B942, transparent)", transform: "translate(30%, -30%)" }} />
            <div className="font-mono text-xs text-[#52525B] tracking-wider mb-2">VERDICT</div>
            <h1 className="font-display mb-3" style={{ fontSize: "clamp(32px,4vw,52px)", fontWeight: 300 }}>
              VERIFY BEFORE APPLYING
            </h1>
            <p className="font-mono text-sm text-[#A1A1AA] mb-6 max-w-lg">
              The organization appears legitimate but the circulating link is not affiliated with the official institution, and a deadline conflict exists. Do not submit personal information through the linked domain.
            </p>

            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="font-mono text-[10px] text-[#52525B] mb-1">EVIDENCE SCORE</div>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl" style={{ fontWeight: 300 }}>62</span>
                  <span className="font-mono text-sm text-[#52525B]">/100</span>
                </div>
                <div className="w-32 h-1.5 bg-white/10 rounded-full mt-1">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#F5B942] to-[#A3FF12]" style={{ width: "62%" }} />
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-[#52525B] mb-1">RISK LEVEL</div>
                <RiskSignal level="medium" />
              </div>
              <div>
                <div className="font-mono text-[10px] text-[#52525B] mb-1">SOURCES CHECKED</div>
                <div className="font-mono text-sm text-[#F8F9FA]">7 sources</div>
              </div>
            </div>
          </div>

          {/* Quick action row */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Button variant="lime" onClick={() => navigate("/investigation/demo/match")}>
              VIEW STUDENT MATCH →
            </Button>
            <Button variant="violet" onClick={() => navigate("/investigation/demo/evidence")}>
              EVIDENCE GRAPH
            </Button>
            <Button variant="outline" onClick={() => navigate("/monitoring")}>
              SAVE & MONITOR
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#111118] p-1 rounded-xl border border-white/[0.06] mb-6">
            {(["checks", "fact-interpretation"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg font-mono text-xs tracking-wider transition-all cursor-pointer ${tab === t ? "bg-[rgba(124,58,237,0.2)] text-[#F8F9FA] border border-[rgba(124,58,237,0.3)]" : "text-[#52525B] hover:text-[#A1A1AA]"}`}
              >
                {t === "checks" ? "CRITICAL CHECKS" : "FACT VS INTERPRETATION"}
              </button>
            ))}
          </div>

          {tab === "checks" && (
            <div className="space-y-2">
              {checks.map((check) => (
                <div key={check.label}>
                  <button
                    onClick={() => setExpandedCheck(expandedCheck === check.label ? null : check.label)}
                    className="w-full card-noir p-5 text-left hover:border-white/15 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <StatusBadge status={check.verdict} />
                      <span className="font-mono text-sm text-[#F8F9FA] flex-1">{check.label}</span>
                      <span className="font-mono text-[10px] text-[#52525B]">
                        {expandedCheck === check.label ? "▲" : "▼"}
                      </span>
                    </div>
                    {expandedCheck === check.label && (
                      <div className="mt-4 pt-4 border-t border-white/[0.06]">
                        <p className="font-mono text-xs text-[#A1A1AA] mb-2">{check.explanation}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-[#52525B]">EVIDENCE:</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate("/investigation/demo/evidence"); }}
                            className="font-mono text-[9px] text-[#7C3AED] hover:text-[#A855F7] cursor-pointer"
                          >
                            {check.evidence} →
                          </button>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "fact-interpretation" && (
            <div className="space-y-4">
              <div className="card-noir p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-[#A3FF12]" />
                  <span className="font-mono text-xs tracking-wider text-[#A3FF12]">FACT</span>
                  <span className="font-mono text-[10px] text-[#52525B] ml-1">Directly supported by source</span>
                </div>
                <p className="font-display text-base text-[#F8F9FA] leading-relaxed" style={{ fontWeight: 300 }}>
                  {factVsInterpretation.fact}
                </p>
                <div className="mt-4 font-mono text-[10px] text-[#52525B]">Source: university.edu.pk · Retrieved Aug 22, 2025</div>
              </div>

              <div className="card-noir p-6 border-[rgba(124,58,237,0.2)]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-[#7C3AED]" />
                  <span className="font-mono text-xs tracking-wider text-[#7C3AED]">INTERPRETATION</span>
                  <span className="font-mono text-[10px] text-[#52525B] ml-1">Trustlify's reasoned analysis</span>
                </div>
                <p className="font-mono text-sm text-[#A1A1AA] leading-relaxed">
                  {factVsInterpretation.interpretation}
                </p>
              </div>

              <div className="card-noir p-4 border-[rgba(245,185,66,0.2)]">
                <div className="font-mono text-[10px] text-[#52525B]">
                  ⚠ Facts and interpretations are kept separate. Trustlify does not present reasoning as fact.
                </div>
              </div>
            </div>
          )}

          {/* Action Plan */}
          <div className="mt-8 card-noir-violet p-6">
            <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">WHAT TO DO NEXT</div>
            <div className="space-y-3 mb-6">
              {[
                "Open the official university website directly (do not use the circulating link).",
                "Do not submit CNIC, bank details, or OTP to the linked domain.",
                "Confirm the current deadline on the official source (Aug 25, not Aug 15).",
                "Save this investigation and set a monitoring alert for deadline changes.",
                "If you received this link via WhatsApp, report it in your group.",
              ].map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#A3FF12] flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-mono text-sm text-[#A1A1AA]">{action}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="lime" onClick={() => {}}>OPEN VERIFIED SOURCE</Button>
              <Button variant="outline" onClick={() => navigate("/monitoring")}>SAVE & MONITOR</Button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
