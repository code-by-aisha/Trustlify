import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui";

type InputMode = "link" | "text" | "image";

export default function Investigate() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<InputMode>("link");
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);

  const examplePlaceholders: Record<InputMode, string> = {
    link: "https://apply-scholarship.com/fund2025\n\nPaste any URL, link, or website address to investigate.",
    text: "Ye scholarship genuine hai? deadline kya hai?\n\nPaste any post, WhatsApp message, social media content, job description, or claim.",
    image: "",
  };

  const handleInvestigate = () => {
    if (input.trim() || mode === "image") {
      navigate("/investigation/demo/progress");
    }
  };

  return (
    <AppShell>
      <div className="pt-16 min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-px w-10 bg-[#7C3AED]" />
              <span className="font-mono text-xs tracking-[0.2em] text-[#7C3AED]">NEW INVESTIGATION</span>
              <div className="h-px w-10 bg-[#7C3AED]" />
            </div>
            <h1 className="font-display mb-3" style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 300 }}>
              WHAT DO YOU WANT<br />TO INVESTIGATE?
            </h1>
            <p className="font-mono text-sm text-[#52525B]">
              Paste a scholarship, internship, job, website, post, message, or claim.
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2 mb-6 bg-[#111118] p-1.5 rounded-2xl border border-white/[0.06]">
            {([
              { key: "link" as const, label: "PASTE LINK", icon: "🔗" },
              { key: "text" as const, label: "PASTE TEXT", icon: "📋" },
              { key: "image" as const, label: "UPLOAD IMAGE", icon: "🖼" },
            ]).map((item) => (
              <button
                key={item.key}
                onClick={() => setMode(item.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs tracking-wider transition-all cursor-pointer ${
                  mode === item.key
                    ? "bg-[#7C3AED] text-white shadow-[0_0_16px_rgba(124,58,237,0.3)]"
                    : "text-[#52525B] hover:text-[#A1A1AA]"
                }`}
              >
                <span className="hidden sm:inline">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="card-noir-violet p-1.5 mb-4">
            {mode !== "image" ? (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={examplePlaceholders[mode]}
                className="w-full bg-transparent px-5 py-5 font-mono text-sm text-[#F8F9FA] placeholder:text-[#52525B] focus:outline-none resize-none leading-relaxed"
                rows={7}
                autoFocus
              />
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleInvestigate(); }}
                className={`w-full rounded-xl border-2 border-dashed p-16 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                  dragging ? "border-[#7C3AED] bg-[rgba(124,58,237,0.08)]" : "border-white/10 hover:border-white/20"
                }`}
                onClick={() => handleInvestigate()}
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(124,58,237,0.1)] flex items-center justify-center text-2xl">🖼</div>
                <div className="text-center">
                  <div className="font-mono text-sm text-[#A1A1AA] mb-1">Drop screenshot or PDF here</div>
                  <div className="font-mono text-xs text-[#52525B]">or click to browse · PNG, JPG, PDF up to 20MB</div>
                </div>
                <div className="font-mono text-[10px] text-[#52525B] mt-2">For demo: click to simulate upload</div>
              </div>
            )}
          </div>

          {/* Advanced options */}
          <div className="flex items-center gap-3 mb-8">
            <button className="px-4 py-2 rounded-xl border border-white/[0.06] font-mono text-xs text-[#52525B] hover:text-[#A1A1AA] hover:border-white/15 transition-all cursor-pointer flex items-center gap-2">
              📄 UPLOAD PDF
            </button>
            <div className="flex-1" />
            <span className="font-mono text-[10px] text-[#52525B]">Evidence, not guesses.</span>
          </div>

          {/* CTA */}
          <Button
            variant="lime"
            size="lg"
            className="w-full justify-center"
            onClick={handleInvestigate}
            disabled={mode !== "image" && !input.trim()}
          >
            INVESTIGATE →
          </Button>

          {/* Example prompts */}
          <div className="mt-8">
            <div className="font-mono text-[10px] text-[#52525B] mb-3 tracking-wider">TRY AN EXAMPLE</div>
            <div className="flex flex-wrap gap-2">
              {[
                "apply-scholarship.com/fund2025",
                "Ye scholarship genuine hai?",
                "HEC Research Fellowship 2025 application",
                "WhatsApp: Deadline extended to Aug 30",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => { setMode(example.startsWith("http") || example.endsWith(".com/fund2025") ? "link" : "text"); setInput(example); }}
                  className="px-3 py-1.5 rounded-full border border-white/[0.06] font-mono text-[10px] text-[#52525B] hover:text-[#A1A1AA] hover:border-white/15 transition-all cursor-pointer"
                >
                  {example.length > 30 ? example.slice(0, 30) + "…" : example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
