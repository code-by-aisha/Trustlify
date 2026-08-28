import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui";

const sections = ["Profile", "Language", "Privacy", "Notifications", "Saved Evidence"];

export default function Settings() {
  const navigate = useNavigate();
  const [active, setActive] = useState("Profile");
  const [lang, setLang] = useState("English");
  const [notifications, setNotifications] = useState({ deadlineChanges: true, newEvidence: true, weeklyDigest: false, monitoringAlerts: true });

  return (
    <AppShell>
      <div className="pt-16 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="font-mono text-[10px] text-[#52525B] tracking-wider mb-2">SETTINGS</div>
            <h1 className="font-display" style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 300 }}>Account Settings</h1>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar nav */}
            <div className="col-span-12 md:col-span-3">
              <nav className="space-y-1">
                {sections.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActive(s)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl font-mono text-xs tracking-wider transition-all cursor-pointer ${
                      active === s ? "bg-[rgba(124,58,237,0.15)] text-[#F8F9FA] border border-[rgba(124,58,237,0.3)]" : "text-[#52525B] hover:text-[#A1A1AA]"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="col-span-12 md:col-span-9">
              {active === "Profile" && (
                <div className="space-y-4">
                  <div className="card-noir p-6">
                    <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">STUDENT PROFILE</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: "FULL NAME", value: "Ahmad Khan" },
                        { label: "EMAIL", value: "ahmad@university.edu.pk" },
                        { label: "AGE", value: "22" },
                        { label: "LOCATION", value: "Karachi, Pakistan" },
                        { label: "EDUCATION", value: "BS Computer Science" },
                        { label: "INSTITUTION", value: "FAST NUCES Karachi" },
                      ].map((f) => (
                        <div key={f.label}>
                          <label className="font-mono text-[9px] text-[#52525B] tracking-wider block mb-1">{f.label}</label>
                          <input
                            defaultValue={f.value}
                            className="w-full bg-[#0A0A0F] border border-white/[0.07] rounded-xl px-3 py-2.5 font-mono text-xs text-[#F8F9FA] focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <label className="font-mono text-[9px] text-[#52525B] tracking-wider block mb-1">SKILLS</label>
                      <div className="flex flex-wrap gap-2">
                        {["Python", "Data Analysis", "Research", "Writing"].map((s) => (
                          <span key={s} className="px-3 py-1 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.08)] font-mono text-xs text-[#F8F9FA]">{s}</span>
                        ))}
                        <button className="px-3 py-1 rounded-full border border-dashed border-white/15 font-mono text-xs text-[#52525B] cursor-pointer">+ Add</button>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Button variant="violet" size="sm">SAVE CHANGES</Button>
                    </div>
                  </div>
                </div>
              )}

              {active === "Language" && (
                <div className="card-noir p-6">
                  <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">LANGUAGE PREFERENCE</div>
                  <div className="space-y-2">
                    {[
                      { label: "English", available: true },
                      { label: "Urdu (اردو)", available: true },
                      { label: "Roman Urdu", available: true },
                      { label: "Sindhi (سنڌي)", available: false, note: "Pending validation" },
                    ].map((l) => (
                      <button
                        key={l.label}
                        onClick={() => l.available && setLang(l.label)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                          l.available ? "cursor-pointer" : "opacity-40 cursor-not-allowed"
                        } ${lang === l.label ? "border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)]" : "border-white/[0.06] hover:border-white/15"}`}
                      >
                        <span className="font-mono text-sm text-[#F8F9FA]">{l.label}</span>
                        <div className="flex items-center gap-2">
                          {l.note && <span className="font-mono text-[10px] text-[#52525B]">{l.note}</span>}
                          {lang === l.label && <span className="text-[#A3FF12] text-sm">✓</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {active === "Privacy" && (
                <div className="space-y-4">
                  <div className="card-noir p-6">
                    <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">DATA MANAGEMENT</div>
                    <div className="space-y-4">
                      {[
                        { label: "Delete all uploaded content", desc: "Removes all images, PDFs, and documents you've uploaded for investigation.", color: "text-[#F5B942]", btnColor: "outline" as const },
                        { label: "Delete saved investigations", desc: "Removes your investigation history and saved reports.", color: "text-[#F5B942]", btnColor: "outline" as const },
                        { label: "Delete account", desc: "Permanently removes your account, profile, and all data. This cannot be undone.", color: "text-[#FF4D5E]", btnColor: "outline" as const },
                      ].map((item) => (
                        <div key={item.label} className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.06]">
                          <div>
                            <div className={`font-mono text-sm mb-0.5 ${item.color}`}>{item.label}</div>
                            <div className="font-mono text-[10px] text-[#52525B]">{item.desc}</div>
                          </div>
                          <Button variant={item.btnColor} size="sm" className="flex-shrink-0">DELETE</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-noir p-5 border-[rgba(163,255,18,0.1)]">
                    <div className="font-mono text-[10px] text-[#52525B]">
                      ✓ Trustlify does not sell your data. Uploaded content is deleted after investigation unless you save it explicitly.
                    </div>
                  </div>
                </div>
              )}

              {active === "Notifications" && (
                <div className="card-noir p-6">
                  <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">NOTIFICATION PREFERENCES</div>
                  <div className="space-y-4">
                    {[
                      { key: "deadlineChanges" as const, label: "Deadline changes", desc: "Notify when a monitored deadline changes" },
                      { key: "monitoringAlerts" as const, label: "Monitoring alerts", desc: "Notify when any monitored opportunity changes" },
                      { key: "newEvidence" as const, label: "New evidence", desc: "Notify when new sources are found for saved investigations" },
                      { key: "weeklyDigest" as const, label: "Weekly digest", desc: "Summary of your investigations and monitored opportunities" },
                    ].map((n) => (
                      <div key={n.key} className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-mono text-sm text-[#F8F9FA]">{n.label}</div>
                          <div className="font-mono text-[10px] text-[#52525B]">{n.desc}</div>
                        </div>
                        <button
                          onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                          className={`relative w-10 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${notifications[n.key] ? "bg-[#7C3AED]" : "bg-white/10"}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${notifications[n.key] ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active === "Saved Evidence" && (
                <div className="card-noir p-6">
                  <div className="font-mono text-xs text-[#7C3AED] tracking-wider mb-4">SAVED EVIDENCE</div>
                  <div className="space-y-2">
                    {[
                      { title: "university.edu.pk — Scholarship official page", date: "Aug 22, 2025", type: "OFFICIAL SOURCE" },
                      { title: "hec.gov.pk — HEC announcement", date: "Aug 20, 2025", type: "GOVERNMENT SOURCE" },
                      { title: "Domain analysis — apply-scholarship.com", date: "Aug 22, 2025", type: "TECHNICAL EVIDENCE" },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-white/15 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-[#F8F9FA] truncate">{e.title}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="font-mono text-[9px] text-[#7C3AED]">{e.type}</span>
                            <span className="font-mono text-[9px] text-[#52525B]">{e.date}</span>
                          </div>
                        </div>
                        <button className="font-mono text-[10px] text-[#52525B] hover:text-[#FF4D5E] cursor-pointer">DELETE</button>
                      </div>
                    ))}
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
