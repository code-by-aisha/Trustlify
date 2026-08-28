import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { StatusBadge } from "../components/ui";

const history = [
  { date: "Aug 22, 2025", title: "Suspicious scholarship on Instagram", org: "Unknown", verdict: "VERIFY BEFORE APPLYING", status: "conflict" as const, match: "STRONG MATCH" },
  { date: "Aug 20, 2025", title: "LUMS MBA Fellowship link", org: "LUMS", verdict: "LIKELY LEGITIMATE", status: "verified" as const, match: "PARTIAL MATCH" },
  { date: "Aug 18, 2025", title: "WhatsApp internship forward", org: "Unknown", verdict: "HIGH RISK — DO NOT PROCEED", status: "risk" as const, match: "N/A" },
  { date: "Aug 15, 2025", title: "HEC Scholarship portal", org: "HEC", verdict: "LEGITIMATE", status: "verified" as const, match: "STRONG MATCH" },
  { date: "Aug 12, 2025", title: "Google Summer of Code 2025", org: "Google", verdict: "VERIFY BEFORE APPLYING", status: "conflict" as const, match: "LIKELY MATCH" },
  { date: "Aug 8, 2025", title: "UET merit list announcement", org: "UET Lahore", verdict: "LEGITIMATE", status: "verified" as const, match: "N/A" },
  { date: "Aug 3, 2025", title: "Facebook job ad screenshot", org: "Unknown company", verdict: "HIGH RISK", status: "risk" as const, match: "PARTIAL MATCH" },
  { date: "Jul 28, 2025", title: "Fulbright application guide PDF", org: "Fulbright Pakistan", verdict: "LEGITIMATE", status: "verified" as const, match: "STRONG MATCH" },
];

export default function History() {
  const navigate = useNavigate();

  const verdictColor: Record<string, string> = {
    LEGITIMATE: "text-[#A3FF12]",
    "LIKELY LEGITIMATE": "text-[#A3FF12]",
    "VERIFY BEFORE APPLYING": "text-[#F5B942]",
    "HIGH RISK — DO NOT PROCEED": "text-[#FF4D5E]",
    "HIGH RISK": "text-[#FF4D5E]",
  };

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-10">
            <div className="font-mono text-[10px] text-[#52525B] tracking-wider mb-2">INVESTIGATION HISTORY</div>
            <h1 className="font-display" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 300 }}>
              {history.length} Investigations
            </h1>
          </div>

          {/* Editorial timeline */}
          <div className="relative">
            <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-white/[0.06] hidden md:block" />
            <div className="space-y-2">
              {history.map((inv, i) => (
                <div key={i} className="flex items-start gap-0 group">
                  {/* Date */}
                  <div className="hidden md:block w-28 text-right pr-6 pt-4 flex-shrink-0">
                    <div className="font-mono text-[10px] text-[#52525B] leading-tight">
                      {inv.date.split(",")[0]}
                      <br />
                      {inv.date.split(",")[1]?.trim()}
                    </div>
                  </div>

                  {/* Node */}
                  <div className="hidden md:flex items-start pt-4 flex-shrink-0 w-6 justify-center">
                    <div className={`w-2 h-2 rounded-full ring-4 ring-[#0A0A0F] flex-shrink-0 ${
                      inv.status === "verified" ? "bg-[#A3FF12]"
                      : inv.status === "conflict" ? "bg-[#F5B942]"
                      : "bg-[#FF4D5E]"
                    }`} />
                  </div>

                  {/* Card */}
                  <div className="flex-1 md:pl-6 pb-2">
                    <div
                      onClick={() => navigate("/investigation/demo")}
                      className="card-noir p-5 hover:border-white/15 transition-all cursor-pointer group-hover:bg-white/[0.01]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="md:hidden font-mono text-[10px] text-[#52525B] mb-1">{inv.date}</div>
                          <div className="font-mono text-sm font-medium text-[#F8F9FA] mb-0.5">{inv.title}</div>
                          <div className="font-mono text-[10px] text-[#52525B]">{inv.org}</div>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-3 flex items-center flex-wrap gap-4">
                        <div>
                          <span className={`font-mono text-xs font-medium ${verdictColor[inv.verdict] || "text-[#A1A1AA]"}`}>
                            {inv.verdict}
                          </span>
                        </div>
                        {inv.match !== "N/A" && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-[#52525B]">MATCH</span>
                            <span className="font-mono text-[9px] text-[#A1A1AA]">{inv.match}</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate("/investigation/demo/evidence"); }}
                          className="ml-auto font-mono text-[9px] text-[#52525B] hover:text-[#7C3AED] transition-colors cursor-pointer"
                        >
                          VIEW EVIDENCE →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
