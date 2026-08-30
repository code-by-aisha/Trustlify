/**
 * Trustlify Backend — Profile Persistence Tests (fixture-based)
 *
 * Covers the student profile persistence regression:
 * - student profile create (role + authenticated user id, null optional fields)
 * - student profile fetch (snake_case → camelCase mapping, role restoration)
 * - student profile update (supplied fields only)
 * - profile missing (null)
 * - ownership fields cannot be spoofed through the request body
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

import { createProfileSchema, updateProfileSchema } from "../validators/profile.js";
import * as profileService from "../services/profileService.js";

const STUDENT_INPUT = {
  displayName: "Sara Student",
  role: "student",
  education: "FSc / A-Levels",
  age: 20,
  location: "Islamabad",
  skills: ["Python", "Research"],
  interests: ["Scholarships"],
  experience: null,
  portfolioUrl: null,
};

const STUDENT_ROW = {
  id: "profile-row-1",
  auth_user_id: "auth-user-a",
  role: "student",
  display_name: "Sara Student",
  education: "FSc / A-Levels",
  age: 20,
  location: "Islamabad",
  skills: ["Python", "Research"],
  interests: ["Scholarships"],
  experience: null,
  portfolio_url: null,
  language: "English",
  timezone: "Asia/Karachi",
  notification_preferences: {},
  created_at: "2026-08-30T10:00:00Z",
  updated_at: "2026-08-30T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("profile validators", () => {
  it("accepts a student onboarding payload with null optional fields", () => {
    const parsed = createProfileSchema.parse(STUDENT_INPUT);
    expect(parsed.role).toBe("student");
    expect(parsed.experience).toBeNull();
    expect(parsed.portfolioUrl).toBeNull();
    expect(parsed.age).toBe(20);
  });

  it("rejects empty strings for optional text fields (must be null instead)", () => {
    const result = createProfileSchema.safeParse({ ...STUDENT_INPUT, education: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid role", () => {
    const result = createProfileSchema.safeParse({ ...STUDENT_INPUT, role: "admin" });
    expect(result.success).toBe(false);
  });

  it("strips ownership fields — the user id cannot be set through the body", () => {
    const parsed = createProfileSchema.parse({
      ...STUDENT_INPUT,
      auth_user_id: "someone-else",
      id: "row-id",
      userId: "someone-else",
    });
    expect(parsed).not.toHaveProperty("auth_user_id");
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("userId");
  });

  it("update schema accepts nulls and strips ownership fields", () => {
    const parsed = updateProfileSchema.parse({
      displayName: "Sara Verified",
      education: null,
      auth_user_id: "someone-else",
    });
    expect(parsed.education).toBeNull();
    expect(parsed).not.toHaveProperty("auth_user_id");
  });
});

describe("profileService.createProfile (student onboarding)", () => {
  it("persists with the authenticated user's id and the student role", async () => {
    db.single.mockResolvedValue({ data: STUDENT_ROW, error: null });

    const profile = await profileService.createProfile(
      "auth-user-a",
      createProfileSchema.parse(STUDENT_INPUT),
    );

    expect(db.upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = db.upsert.mock.calls[0];
    expect(payload.auth_user_id).toBe("auth-user-a");
    expect(payload.role).toBe("student");
    expect(payload.display_name).toBe("Sara Student");
    expect(payload.experience).toBeNull();
    expect(options).toEqual({ onConflict: "auth_user_id" });

    // API shape mapping
    expect(profile.userId).toBe("auth-user-a");
    expect(profile.role).toBe("student");
    expect(profile.displayName).toBe("Sara Student");
    expect(profile.skills).toEqual(["Python", "Research"]);
    expect(profile.portfolioUrl).toBeNull();
  });
});

describe("profileService.getProfile", () => {
  it("fetches the profile scoped to the authenticated user and restores the role", async () => {
    db.maybeSingle.mockResolvedValue({ data: STUDENT_ROW, error: null });

    const profile = await profileService.getProfile("auth-user-a");

    expect(db.eq).toHaveBeenCalledWith("auth_user_id", "auth-user-a");
    expect(profile?.displayName).toBe("Sara Student");
    expect(profile?.role).toBe("student");
    expect(profile?.location).toBe("Islamabad");
    expect(profile?.notificationPreferences).toEqual({});
  });

  it("returns null when the profile is missing", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });

    const profile = await profileService.getProfile("auth-user-a");

    expect(profile).toBeNull();
  });
});

describe("profileService.updateProfile", () => {
  it("upserts only the supplied fields, keyed to the authenticated user", async () => {
    db.single.mockResolvedValue({
      data: { ...STUDENT_ROW, display_name: "Sara Verified" },
      error: null,
    });

    const input = updateProfileSchema.parse({
      displayName: "Sara Verified",
      auth_user_id: "someone-else", // must be stripped — ownership comes from the JWT
    });
    await profileService.updateProfile("auth-user-a", input);

    const [payload] = db.upsert.mock.calls[0];
    expect(payload.auth_user_id).toBe("auth-user-a");
    expect(payload.display_name).toBe("Sara Verified");
    expect(Object.keys(payload)).not.toContain("education");
    expect(Object.keys(payload)).not.toContain("skills");
  });

  it("returns the current profile without writing when no fields are supplied", async () => {
    db.maybeSingle.mockResolvedValue({ data: STUDENT_ROW, error: null });

    const profile = await profileService.updateProfile("auth-user-a", {});

    expect(db.upsert).not.toHaveBeenCalled();
    expect(profile?.displayName).toBe("Sara Student");
    expect(profile?.role).toBe("student");
  });
});
