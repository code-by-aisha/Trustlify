/**
 * Trustlify — Structured student profile fields (update spec 01–03, 09)
 *
 * Deterministic, fixture-based: education-level mapping, validator behaviour,
 * column mapping through the service, and the matcher reading the new fields.
 * No providers, no network, no live database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => {
  const single = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn(() => ({ select: () => ({ single }) }));
  const from = vi.fn(() => ({ upsert, select }));
  return { from, upsert, select, eq, maybeSingle, single };
});

vi.mock("../config/supabase.js", () => ({
  supabaseAdmin: { from: db.from },
}));

import {
  EDUCATION_LEVELS,
  LEVEL_LABEL,
  isEducationLevel,
  levelFromEducationText,
  profileLadderPosition,
} from "../profile/educationLevels.js";
import { createProfileSchema, updateProfileSchema } from "../validators/profile.js";
import * as profileService from "../services/profileService.js";
import { calculateStudentMatch, type StudentProfileFacts } from "../engines/studentMatcher.js";

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── 1. Education-level mapping — tables, never a model ──────────────────── */

describe("education level mapping", () => {
  it("maps every option the existing education select offers to a level", () => {
    expect(levelFromEducationText("Matric / O-Levels")).toBe("HIGH_SCHOOL");
    expect(levelFromEducationText("FSc / A-Levels")).toBe("COLLEGE");
    expect(levelFromEducationText("BS / Bachelor's")).toBe("UNDERGRADUATE");
    expect(levelFromEducationText("MS / Master's")).toBe("POSTGRADUATE");
    expect(levelFromEducationText("PhD")).toBe("POSTGRADUATE");
    // Case and spacing must not change the answer.
    expect(levelFromEducationText("  fsc/a-levels ")).toBe("COLLEGE");
  });

  it("reads free-text qualifications the student typed themselves", () => {
    expect(levelFromEducationText("In my 3rd year of BSc Electrical Engineering")).toBe(
      "UNDERGRADUATE",
    );
    expect(levelFromEducationText("HSC in Pre-Medical")).toBe("COLLEGE");
    expect(levelFromEducationText("PhD candidate in Physics")).toBe("POSTGRADUATE");
  });

  it("returns null instead of guessing a qualification", () => {
    expect(levelFromEducationText("Gap year, self-taught")).toBeNull();
    expect(levelFromEducationText("")).toBeNull();
    expect(levelFromEducationText(null)).toBeNull();
    // A bare word inside another word is not a level ("undergraduate" ≠ "graduate")
    expect(isEducationLevel("SENIOR")).toBe(false);
    expect(EDUCATION_LEVELS).toContain("POSTGRADUATE");
  });

  it("ranks the ladder so bachelor-level entries stay comparable", () => {
    expect(profileLadderPosition("HIGH_SCHOOL", null)).toBe(1);
    expect(profileLadderPosition("COLLEGE", null)).toBe(2);
    expect(profileLadderPosition("UNDERGRADUATE", null)).toBe(3);
    expect(profileLadderPosition("GRADUATE", null)).toBe(3);
    expect(profileLadderPosition("POSTGRADUATE", null)).toBe(4);
    // OTHER carries no rank, so the text decides — and text alone when no column set.
    expect(profileLadderPosition("OTHER", "BS / Bachelor's")).toBe(3);
    expect(profileLadderPosition("OTHER", null)).toBeNull();
    expect(profileLadderPosition(null, "Matric / O-Levels")).toBe(1);
    expect(profileLadderPosition("NOT_A_LEVEL", "MS / Master's")).toBe(4);
  });
});

/* ─── 2. Validator — optional, nullable, bounded ──────────────────────────── */

describe("profile validators with the new optional fields", () => {
  it("keeps an old payload valid exactly as it was", () => {
    const parsed = createProfileSchema.parse({
      displayName: "Sara",
      role: "student",
      education: "FSc / A-Levels",
    });
    expect(parsed).not.toHaveProperty("country");
    expect(parsed).not.toHaveProperty("educationLevel");
    expect(parsed).not.toHaveProperty("fieldOfStudy");
  });

  it("accepts the structured fields and nulls them out when blank", () => {
    const parsed = updateProfileSchema.parse({
      country: " Pakistan ",
      fieldOfStudy: "Computer Science",
      educationLevel: "UNDERGRADUATE",
      experience: null,
    });
    expect(parsed.country).toBe("Pakistan");
    expect(parsed.fieldOfStudy).toBe("Computer Science");
    expect(parsed.educationLevel).toBe("UNDERGRADUATE");
    expect(parsed.experience).toBeNull();
  });

  it("treats an empty country / field as 'not recorded', never an empty string", () => {
    const parsed = updateProfileSchema.parse({ country: "   ", fieldOfStudy: "  " });
    expect(parsed.country).toBeNull();
    expect(parsed.fieldOfStudy).toBeNull();
  });

  it("rejects an invented education level and oversized text", () => {
    expect(
      updateProfileSchema.safeParse({ educationLevel: "FINAL_YEAR" }).success,
    ).toBe(false);
    expect(updateProfileSchema.safeParse({ country: "x".repeat(121) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ fieldOfStudy: "x".repeat(201) }).success).toBe(false);
  });

  it("still strips ownership fields", () => {
    const parsed = updateProfileSchema.parse({
      country: "Pakistan",
      auth_user_id: "someone-else",
      id: "row",
    });
    expect(parsed).not.toHaveProperty("auth_user_id");
    expect(parsed).not.toHaveProperty("id");
  });
});

/* ─── 3. Service — column mapping and the text/level agreement rule ───────── */

const ROW = {
  id: "profile-row-1",
  auth_user_id: "auth-user-a",
  role: "student",
  display_name: "Sara",
  education: "BS / Bachelor's",
  education_level: "UNDERGRADUATE",
  age: 21,
  location: "Islamabad",
  country: "Pakistan",
  field_of_study: "Computer Science",
  skills: [],
  interests: [],
  experience: null,
  portfolio_url: null,
  language: "English",
  timezone: "Asia/Karachi",
  notification_preferences: {},
  created_at: "2026-08-30T10:00:00Z",
  updated_at: "2026-08-30T10:00:00Z",
};

describe("profileService column mapping", () => {
  it("writes the new fields to their snake_case columns", async () => {
    db.single.mockResolvedValue({ data: ROW, error: null });

    const profile = await profileService.createProfile(
      "auth-user-a",
      createProfileSchema.parse({
        displayName: "Sara",
        role: "student",
        education: "BS / Bachelor's",
        country: "Pakistan",
        fieldOfStudy: "Computer Science",
      }),
    );

    const [payload] = db.upsert.mock.calls[0];
    expect(payload.country).toBe("Pakistan");
    expect(payload.field_of_study).toBe("Computer Science");
    // No explicit level was sent, so it is derived from the qualification text.
    expect(payload.education_level).toBe("UNDERGRADUATE");
    expect(profile.country).toBe("Pakistan");
    expect(profile.fieldOfStudy).toBe("Computer Science");
    expect(profile.educationLevel).toBe("UNDERGRADUATE");
  });

  it("lets an explicit structured level win over the text", async () => {
    db.single.mockResolvedValue({ data: ROW, error: null });

    await profileService.createProfile(
      "auth-user-a",
      createProfileSchema.parse({
        role: "student",
        education: "BS / Bachelor's",
        educationLevel: "POSTGRADUATE",
      }),
    );

    const [payload] = db.upsert.mock.calls[0];
    expect(payload.education_level).toBe("POSTGRADUATE");
  });

  it("re-derives the level only when the education text changed without one", async () => {
    db.single.mockResolvedValue({ data: ROW, error: null });

    // (a) text changed, no level in the request → the two must agree again.
    await profileService.updateProfile(
      "auth-user-a",
      updateProfileSchema.parse({ education: "Matric / O-Levels" }),
    );
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      education: "Matric / O-Levels",
      education_level: "HIGH_SCHOOL",
    });

    // (b) explicit level sent with the text → the student's choice is kept.
    await profileService.updateProfile(
      "auth-user-a",
      updateProfileSchema.parse({ education: "Matric / O-Levels", educationLevel: "COLLEGE" }),
    );
    expect(db.upsert.mock.calls[1][0]).toMatchObject({ education_level: "COLLEGE" });

    // (c) neither touched → the stored level is never overwritten with null.
    await profileService.updateProfile("auth-user-a", updateProfileSchema.parse({ age: 22 }));
    expect(Object.keys(db.upsert.mock.calls[2][0])).not.toContain("education_level");
    expect(Object.keys(db.upsert.mock.calls[2][0])).not.toContain("country");
  });

  it("reads the structured fields back from the row", async () => {
    db.maybeSingle.mockResolvedValue({ data: ROW, error: null });
    const profile = await profileService.getProfile("auth-user-a");
    expect(profile?.country).toBe("Pakistan");
    expect(profile?.educationLevel).toBe("UNDERGRADUATE");
    expect(profile?.fieldOfStudy).toBe("Computer Science");
  });
});

/* ─── 4. The matcher actually uses the structured fields (spec 09/10) ─────── */

describe("matcher reading structured profile fields", () => {
  it("compares the country from the structured column, and names it", () => {
    const profile: StudentProfileFacts = { role: "student", country: "Pakistan" };
    const open = calculateStudentMatch({
      profile,
      claims: [{ id: "c1", type: "eligibility", text: "Open to applicants from Pakistan only" }],
    });
    expect(open.result).toBe("ELIGIBLE");
    expect(open.matched[0].detail).toContain("profile country: Pakistan");

    const restricted = calculateStudentMatch({
      profile,
      claims: [{ id: "c2", type: "eligibility", text: "Open to applicants from India only" }],
    });
    expect(restricted.result).toBe("NOT_ELIGIBLE");
    expect(restricted.missing[0].detail).toBe(
      'The requirement names India; your profile country is Pakistan.',
    );
  });

  it("uses education_level where the free text states no qualification", () => {
    const profile: StudentProfileFacts = {
      role: "student",
      education: "Studying at NUST",
      educationLevel: "UNDERGRADUATE",
    };
    const result = calculateStudentMatch({
      profile,
      claims: [{ id: "c1", type: "eligibility", text: "Minimum qualification: Bachelor's degree" }],
    });

    // Without the structured column this had nothing comparable at all.
    expect(result.result).toBe("ELIGIBLE");
    expect(result.matched[0].detail).toContain("Undergraduate (Bachelor's level)");
  });

  it("states a failed education gate as requirement vs. real profile fact", () => {
    const result = calculateStudentMatch({
      profile: { role: "student", education: "Matric" },
      claims: [{ id: "c1", type: "eligibility", text: "Applicants must hold a Master's degree" }],
    });

    expect(result.missing[0].outcome).toBe("MISSING");
    expect(result.missing[0].detail).toContain("Requirement: Master's-level.");
    expect(result.missing[0].detail).toContain("Your profile:");
    expect(result.missing[0].detail).toContain(LEVEL_LABEL.HIGH_SCHOOL);
  });

  it("credits the field of study column and says where the match came from", () => {
    const result = calculateStudentMatch({
      profile: { role: "student", fieldOfStudy: "Data Science" },
      claims: [{ id: "c1", type: "eligibility", text: "Open to students of data science" }],
    });
    expect(result.matched[0].detail).toContain("your recorded field of study (Data Science)");
  });

  it("counts public portfolio skills as supplementary evidence, attributed to the page", () => {
    const result = calculateStudentMatch({
      profile: {
        role: "student",
        skills: ["Python"],
        publicProfileSkills: ["sql"],
        publicProfileDomain: "sara.dev",
      },
      claims: [{ id: "c1", type: "eligibility", text: "Applicants must know SQL" }],
    });

    expect(result.result).toBe("ELIGIBLE");
    expect(result.matched[0].detail).toContain("your public portfolio (sara.dev) shows sql");
    expect(result.matched[0].detail).toContain("not an assumption");
  });
});

/* ─── 6. Skill / interest list normalisation (fix pass part 1) ────────────── */

describe("skill catalogue persistence", () => {
  it("collapses case and spacing variants of the same skill", () => {
    const parsed = updateProfileSchema.parse({
      skills: ["Python", "python", "  PYTHON  ", "Data Analysis"],
    });
    expect(parsed.skills).toEqual(["Python", "Data Analysis"]);
  });

  it("keeps the first spelling the student chose", () => {
    const parsed = updateProfileSchema.parse({ skills: ["machine learning", "Machine Learning"] });
    expect(parsed.skills).toEqual(["machine learning"]);
  });

  it("drops blank entries instead of storing an empty skill", () => {
    const parsed = updateProfileSchema.parse({ skills: ["React", "   ", ""] });
    expect(parsed.skills).toEqual(["React"]);
  });

  it("treats a custom skill the same as a preset one", () => {
    // Nothing in the schema knows about the preset catalogue — a typed skill is
    // persisted verbatim, which is what makes the wider list safe to offer.
    const parsed = createProfileSchema.parse({
      displayName: "Aisha",
      role: "student",
      skills: ["Drone Photography"],
    });
    expect(parsed.skills).toEqual(["Drone Photography"]);
  });

  it("still rejects more than the stored maximum", () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `Skill ${i}`);
    expect(updateProfileSchema.safeParse({ skills: tooMany }).success).toBe(false);
  });
});
