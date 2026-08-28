import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button, StatusBadge } from "../components/ui";

const nodes = [
  { id: "claim", x: 50, y: 50, label: "CLAIM", sublabel: "Fully Funded Scholarship 2025", color: "#7C3AED", border: "rgba(124,58,237,0.7)", type: "claim" },
  { id: "src1", x: 20, y: 22, label: "OFFICIAL SOURCE", sublabel: "university.edu.pk", color: "#A3FF12", border: "rgba(163,255,18,0.5)", type: "source" },
  { id: "src2", x: 78, y: 22, label: "INDEPENDENT", sublabel: "HEC announcement", color: "#A3FF12", border: "rgba(163,255,18,0.4)", type: "source" },
  { id: "src3", x: 80, y: 72, label: "PUBLIC REPORTS", sublabel: "Social media flags", color: "#F5B942", border: "rgba(245,185,66,0.5)", type: "conflict" },
  { id: "ev1", x: 16, y: 72, label: "EVIDENCE", sublabel: "Domain mismatch", color: "#FF4D5E", border: "rgba(255,77,94,0.5)", type: "evidence" },
  { id: "verify", x: 50, y: 85, label: "VERIFICATION", sublabel: "Deadline conflict", color: "#F5B942", border: "rgba(245,185,66,0.5)", type: "verification" },
  { id: "decision", x: 50, y: 15, label: "DECISION", sublabel: "VERIFY BEFORE APPLYING", color: "#A3FF12", border: "rgba(163,255,18,0.7)", type: "decision" },
];

const edges = [
  { from: "claim", to: "src1", color: "#7C3AED", verified: true },
  { from: "claim", to: "src2", color: "#7C3AED", verified: true },
  { from: "claim", to: "src3", color: "#F5B942", verified: false },
  { from: "claim", to: "ev1", color: "#FF4D5E", verified: false },
  { from: "src1", to: "decision", color: "#A3FF12", verified: true },
  { from: "src2", to: "decision", color: "#A3FF12", verified: true },
  { from: "src3", to: "verify", color: "#F5B942", verified: false },
  { from: "ev1", to: "verify", color: "#FF4D5E", verified: false },
  { from: "verify", to: "decision", color: "#F5B942", verified: false },
];

const evidenceDetails: Record<string, { title: string; domain: string; type: string; published: string; relation: "SUPPORTS" | "CONTRADICTS" | "NEUTRAL"; excerpt: string }> = {
  claim: { title: "Original Claim", domain: "Forwarded post", type: "SOCIAL MEDIA", published: "Aug 10, 2025", relation: "NEUTRAL", excerpt: '"Fully Funded Scholarship 2025 is open. Deadline Aug 15. Apply at apply-scholarship.com"' },
  src1: { title: "Official University Website", domain: "university.edu.pk", type: "OFFICIAL SOURCE", published: "Mar 1, 2025", relation: "SUPPORTS", excerpt: "The scholarship is open for applications. Official deadline: August 25, 2025. Apply via the official portal only." },
  src2: { title: "HEC Official Announcement", domain: "hec.gov.pk", type: "GOVERNMENT SOURCE", published: "Feb 28, 2025", relation: "SUPPORTS", excerpt: "Higher Education Commission confirms the scholarship programme is active for the 2025 cycle." },
  src3: { title: "Community Reports", domain: "Various platforms", type: "PUBLIC REPORTS", published: "Aug 12–20, 2025", relation: "CONTRADICTS", excerpt: "Multiple users report the linked domain is not affiliated with the official institution. Domain registered Aug 7, 2025." },
  ev1: { title: "Domain Analysis", domain: "apply-scholarship.com", type: "TECHNICAL EVIDENCE", published: "Aug 22, 2025", relation: "CONTRADICTS", excerpt: "Domain registered 15 days ago. No association found with the official institution. Hosting provider differs from official site." },
  verify: { title: "Deadline Conflict", domain: "Verification layer", type: "CONFLICT EVIDENCE", published: "Aug 22, 2025", relation: "CONTRADICTS", excerpt: "Post claims Aug 15 deadline. Official source confirms Aug 25. A 10-day discrepancy constitutes a significant conflict." },
  decision: { title: "Final Verdict", domain: "Trustlify", type: "DECISION", published: "Aug 22, 2025", relation: "NEUTRAL", excerpt: "VERIFY BEFORE APPLYING. Evidence score: 62/100. Genuine organization, suspicious third-party link, deadline conflict detected." },
};

export default function EvidenceGraph() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list">("graph");

  const selectedEvidence = selected ? evidenceDetails[selected] : null;

  const getNodePos = (id: string) => nodes.find(n => n.id === id) || nodes[0];

  const relationColor: Record<string, string> = {
    SUPPORTS: "text-[#A3FF12] border-[rgba(163,255,18,0.3)] bg-[rgba(163,255,18,0.08)]",
    CONTRADICTS: "text-[#FF4D5E] border-[rgba(255,77,94,0.3)] bg-[rgba(255,77,94,0.08)]",
    NEUTRAL: "text-[#A1A1AA] border-white/15 bg-white/[0.04]",
  };

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="font-mono text-[10px] text-[#52525B] mb-1">DEMO INVESTIGATION · ID #T-2408-0042</div>
              <h1 className="font-display" style={{ fontSize: 28, fontWeight: 300 }}>Evidence Graph</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-[#111118] rounded-full p-1 border border-white/[0.06]">
                {(["graph", "list"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-full font-mono text-xs tracking-wider transition-all cursor-pointer ${view === v ? "bg-[#7C3AED] text-white" : "text-[#52525B]"}`}>
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button variant="lime" size="sm" onClick={() => navigate("/investigation/demo")}>
                VIEW RESULTS →
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {[
              { color: "bg-[#7C3AED]", label: "Connection" },
              { color: "bg-[#A3FF12]", label: "Verified path" },
              { color: "bg-[#F5B942]", label: "Conflict" },
              { color: "bg-[#FF4D5E]", label: "High risk" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-6 h-0.5 rounded ${l.color}`} />
                <span className="font-mono text-[10px] text-[#52525B]">{l.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Graph / List */}
            <div className="lg:col-span-2">
              {view === "graph" ? (
                <div className="card-noir p-2 relative overflow-hidden" style={{ height: 480 }}>
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {edges.map((edge, i) => {
                      const from = getNodePos(edge.from);
                      const to = getNodePos(edge.to);
                      return (
                        <line
                          key={i}
                          x1={`${from.x}%`} y1={`${from.y}%`}
                          x2={`${to.x}%`} y2={`${to.y}%`}
                          stroke={edge.color}
                          strokeWidth="0.3"
                          strokeOpacity={edge.verified ? 0.7 : 0.4}
                          strokeDasharray={edge.verified ? "none" : "1 1"}
                        />
                      );
                    })}
                  </svg>
                  {nodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => setSelected(selected === node.id ? null : node.id)}
                      className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border font-mono text-[8px] transition-all text-center max-w-20 group-hover:scale-105 ${
                          selected === node.id ? "scale-110" : ""
                        }`}
                        style={{
                          background: `${node.color}15`,
                          borderColor: node.border,
                          color: node.color,
                          boxShadow: selected === node.id ? `0 0 16px ${node.color}40` : "none",
                        }}
                      >
                        <div className="font-semibold leading-tight">{node.label}</div>
                        <div className="opacity-70 text-[7px] mt-0.5 truncate">{node.sublabel}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card-noir overflow-hidden">
                  {nodes.map((node, i) => (
                    <button
                      key={node.id}
                      onClick={() => setSelected(selected === node.id ? null : node.id)}
                      className={`w-full flex items-center gap-4 px-6 py-4 text-left cursor-pointer transition-all hover:bg-white/[0.02] ${i < nodes.length - 1 ? "border-b border-white/[0.06]" : ""} ${selected === node.id ? "bg-white/[0.03]" : ""}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: node.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs font-medium" style={{ color: node.color }}>{node.label}</div>
                        <div className="font-mono text-[10px] text-[#52525B] truncate">{node.sublabel}</div>
                      </div>
                      <span className="font-mono text-[10px] text-[#52525B]">VIEW →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-1">
              {selectedEvidence ? (
                <div className="card-noir-violet p-5 h-full">
                  <div className="font-mono text-[10px] text-[#52525B] mb-1">{selectedEvidence.type}</div>
                  <h3 className="font-display text-lg mb-1" style={{ fontWeight: 300 }}>{selectedEvidence.title}</h3>
                  <div className="font-mono text-xs text-[#52525B] mb-4">{selectedEvidence.domain}</div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="font-mono text-[9px] text-[#52525B]">PUBLISHED</div>
                      <div className="font-mono text-[11px] text-[#A1A1AA]">{selectedEvidence.published}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] text-[#52525B]">RETRIEVED</div>
                      <div className="font-mono text-[11px] text-[#A1A1AA]">Aug 22, 2025</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-[#52525B] mb-2">EVIDENCE EXCERPT</div>
                    <div className="font-display text-sm text-[#F8F9FA] leading-relaxed italic" style={{ fontWeight: 300 }}>
                      {selectedEvidence.excerpt}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="font-mono text-[9px] text-[#52525B] mb-2">RELATION</div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full border font-mono text-xs ${relationColor[selectedEvidence.relation]}`}>
                      {selectedEvidence.relation}
                    </span>
                  </div>

                  <button className="w-full py-2 rounded-xl border border-white/10 font-mono text-xs text-[#A1A1AA] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-all cursor-pointer">
                    OPEN SOURCE ↗
                  </button>
                </div>
              ) : (
                <div className="card-noir p-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.08)] flex items-center justify-center mb-4">
                    <span className="text-[#7C3AED] text-xl">⊹</span>
                  </div>
                  <div className="font-mono text-xs text-[#52525B]">
                    Select a node to view evidence details, source information, and relation type.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
