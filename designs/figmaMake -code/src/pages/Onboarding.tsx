import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";

const steps = [
  { num: "01", label: "BASIC" },
  { num: "02", label: "EDUCATION" },
  { num: "03", label: "SKILLS" },
  { num: "04", label: "INTERESTS" },
  { num: "05", label: "COMPLETE" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", age: "", location: "",
    education: "", institution: "", year: "",
    skills: [] as string[], experience: "",
    interests: [] as string[], portfolio: "",
  });

  const skillOptions = ["Python", "Data Analysis", "Research", "Writing", "Design", "JavaScript", "Machine Learning", "Public Speaking", "Project Management", "Excel/Sheets"];
  const interestOptions = ["Scholarships", "Internships", "Research Opportunities", "Hackathons", "Courses", "Jobs", "Fellowships", "Conferences"];

  const toggleSkill = (s: string) => {
    setForm(f => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s] }));
  };

  const toggleInterest = (s: string) => {
    setForm(f => ({ ...f, interests: f.interests.includes(s) ? f.interests.filter(x => x !== s) : [...f.interests, s] }));
  };

  const progress = ((step) / (steps.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col px-4 py-12">
      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <div className="w-7 h-7 rounded-lg bg-[#7C3AED] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 4V10L7 13L1.5 10V4L7 1Z" stroke="#A3FF12" strokeWidth="1.2" fill="none" />
              <path d="M4.5 7L6.5 9L9.5 5.5" stroke="#A3FF12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-mono text-xs tracking-wider text-[#F8F9FA]">TRUSTLIFY</span>
        </div>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-1">
                <div className={`flex flex-col items-center gap-1 ${i <= step ? "" : "opacity-30"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all font-mono text-[10px] ${
                    i < step ? "bg-[#A3FF12] border-[#A3FF12] text-[#0A0A0F]"
                    : i === step ? "border-[#7C3AED] text-[#7C3AED]"
                    : "border-white/15 text-[#52525B]"
                  }`}>
                    {i < step ? "✓" : s.num}
                  </div>
                  <span className="font-mono text-[8px] text-[#52525B] hidden sm:block">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-all ${i < step ? "bg-[#A3FF12]" : "bg-white/[0.06]"}`} style={{ width: "2rem" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1">
          {step === 0 && (
            <div className="animate-fade-up">
              <div className="font-mono text-[10px] text-[#7C3AED] tracking-wider mb-2">STEP 01 · BASIC</div>
              <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>Tell us about yourself.</h2>
              <div className="space-y-4">
                <Field label="FULL NAME" placeholder="Ahmad Khan">
                  <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ahmad Khan" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="AGE">
                    <input className={inputClass} value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="22" type="number" />
                  </Field>
                  <Field label="LOCATION">
                    <input className={inputClass} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Karachi, Pakistan" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-up">
              <div className="font-mono text-[10px] text-[#7C3AED] tracking-wider mb-2">STEP 02 · EDUCATION</div>
              <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>Your academic background.</h2>
              <div className="space-y-4">
                <Field label="DEGREE / QUALIFICATION">
                  <select className={inputClass} value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))}>
                    <option value="">Select level</option>
                    <option>Matric / O-Levels</option>
                    <option>FSc / A-Levels</option>
                    <option>BS / Bachelor's</option>
                    <option>MS / Master's</option>
                    <option>PhD</option>
                  </select>
                </Field>
                <Field label="INSTITUTION">
                  <input className={inputClass} value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="LUMS, NED University..." />
                </Field>
                <Field label="YEAR / SEMESTER">
                  <input className={inputClass} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="3rd year, Final year..." />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-up">
              <div className="font-mono text-[10px] text-[#7C3AED] tracking-wider mb-2">STEP 03 · SKILLS</div>
              <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>What are you good at?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {skillOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSkill(s)}
                    className={`px-3 py-2 rounded-full border font-mono text-xs transition-all cursor-pointer ${
                      form.skills.includes(s)
                        ? "border-[#7C3AED] bg-[rgba(124,58,237,0.15)] text-[#F8F9FA]"
                        : "border-white/10 text-[#52525B] hover:border-white/20 hover:text-[#A1A1AA]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Field label="EXPERIENCE / PROJECTS (OPTIONAL)">
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={form.experience}
                  onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
                  placeholder="Briefly describe any relevant experience, projects, or achievements..."
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-up">
              <div className="font-mono text-[10px] text-[#7C3AED] tracking-wider mb-2">STEP 04 · INTERESTS</div>
              <h2 className="font-display mb-8" style={{ fontSize: 36, fontWeight: 300 }}>What do you investigate?</h2>
              <p className="font-mono text-xs text-[#52525B] mb-6">Select the types of opportunities you most commonly encounter and need to verify.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {interestOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleInterest(s)}
                    className={`px-3 py-2 rounded-full border font-mono text-xs transition-all cursor-pointer ${
                      form.interests.includes(s)
                        ? "border-[#A3FF12] bg-[rgba(163,255,18,0.1)] text-[#F8F9FA]"
                        : "border-white/10 text-[#52525B] hover:border-white/20 hover:text-[#A1A1AA]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Field label="PORTFOLIO / LINKEDIN (OPTIONAL)">
                <input className={inputClass} value={form.portfolio} onChange={e => setForm(f => ({ ...f, portfolio: e.target.value }))} placeholder="https://..." />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-up text-center">
              <div className="w-16 h-16 rounded-full bg-[rgba(163,255,18,0.1)] border border-[rgba(163,255,18,0.3)] flex items-center justify-center mx-auto mb-6">
                <span className="text-[#A3FF12] text-2xl">✓</span>
              </div>
              <div className="font-mono text-[10px] text-[#A3FF12] tracking-wider mb-2">PROFILE COMPLETE</div>
              <h2 className="font-display mb-4" style={{ fontSize: 40, fontWeight: 300 }}>You're ready to investigate.</h2>
              <p className="font-mono text-sm text-[#52525B] mb-10 max-w-sm mx-auto">
                Your student profile powers personalized eligibility matching. You can update it anytime in settings.
              </p>
              <div className="card-noir p-5 text-left max-w-xs mx-auto mb-8">
                <div className="font-mono text-[10px] text-[#52525B] mb-3">YOUR PROFILE</div>
                <div className="space-y-2">
                  {[
                    { label: "Name", value: form.name || "Ahmad Khan" },
                    { label: "Education", value: form.education || "BS Computer Science" },
                    { label: "Location", value: form.location || "Karachi, Pakistan" },
                    { label: "Skills", value: form.skills.length ? form.skills.slice(0, 3).join(", ") : "Python, Research" },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between">
                      <span className="font-mono text-[10px] text-[#52525B]">{f.label}</span>
                      <span className="font-mono text-[10px] text-[#A1A1AA]">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 && step < 4 ? (
            <button onClick={() => setStep(s => s - 1)} className="font-mono text-xs text-[#52525B] hover:text-[#A1A1AA] cursor-pointer">
              ← BACK
            </button>
          ) : <div />}

          {step < 4 ? (
            <Button variant="violet" onClick={() => setStep(s => s + 1)}>
              {step === 3 ? "COMPLETE PROFILE" : "CONTINUE"} →
            </Button>
          ) : (
            <Button variant="lime" size="lg" onClick={() => navigate("/dashboard")}>
              GO TO DASHBOARD →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-[#52525B] tracking-wider block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-[#111118] border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-sm text-[#F8F9FA] placeholder:text-[#52525B] focus:outline-none focus:border-[rgba(124,58,237,0.5)] transition-colors appearance-none";
