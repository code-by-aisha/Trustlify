/**
 * Trustlify Backend — Profile Service
 *
 * Phase 2: Real Supabase persistence for user profiles.
 */

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";
import { levelFromEducationText } from "../profile/educationLevels.js";
import type { CreateProfileInput } from "../validators/profile.js";

interface ProfileRow {
  id: string;
  auth_user_id: string;
  role: string;
  display_name: string | null;
  education: string | null;
  education_level: string | null;
  age: number | null;
  location: string | null;
  country: string | null;
  field_of_study: string | null;
  skills: string[];
  interests: string[];
  experience: string | null;
  portfolio_url: string | null;
  language: string;
  timezone: string;
  notification_preferences: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

/**
 * Map a database profile row to the API response shape.
 */
function mapProfileRow(row: ProfileRow) {
  return {
    id: row.id,
    userId: row.auth_user_id,
    role: row.role,
    displayName: row.display_name,
    education: row.education,
    educationLevel: row.education_level,
    age: row.age,
    location: row.location,
    country: row.country,
    fieldOfStudy: row.field_of_study,
    skills: row.skills ?? [],
    interests: row.interests ?? [],
    experience: row.experience,
    portfolioUrl: row.portfolio_url,
    language: row.language,
    timezone: row.timezone,
    notificationPreferences: row.notification_preferences ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a profile for the authenticated user.
 * If a profile already exists, upsert it.
 */
export async function createProfile(
  userId: string,
  input: CreateProfileInput,
) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        auth_user_id: userId,
        display_name: input.displayName ?? null,
        role: input.role ?? "general",
        education: input.education ?? null,
        // An explicit structured level always wins; otherwise read one from the
        // qualification text so old forms keep populating the new field.
        education_level:
          input.educationLevel ?? levelFromEducationText(input.education ?? null),
        age: input.age ?? null,
        location: input.location ?? null,
        country: input.country ?? null,
        field_of_study: input.fieldOfStudy ?? null,
        skills: input.skills ?? [],
        interests: input.interests ?? [],
        experience: input.experience ?? null,
        portfolio_url: input.portfolioUrl ?? null,
      },
      { onConflict: "auth_user_id" },
    )
    .select()
    .single();

  if (error) {
    throw new AppError(500, "PROFILE_CREATE_FAILED", "Failed to create profile");
  }

  return mapProfileRow(data as ProfileRow);
}

/**
 * Get a user's profile.
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "PROFILE_FETCH_FAILED", "Failed to fetch profile");
  }

  if (!data) return null;

  return mapProfileRow(data as ProfileRow);
}

/**
 * Update the authenticated user's profile fields.
 * Upserts so the first save works for users who skipped onboarding
 * (no profile row yet) — supplied fields only, existing fields preserved.
 */
export async function updateProfile(
  userId: string,
  input: Record<string, unknown>,
) {
  // Map camelCase API fields to snake_case DB columns
  const dbFields: Record<string, unknown> = {};
  if (input.displayName !== undefined) dbFields.display_name = input.displayName;
  if (input.education !== undefined) dbFields.education = input.education;
  if (input.educationLevel !== undefined) dbFields.education_level = input.educationLevel;
  if (input.age !== undefined) dbFields.age = input.age;
  if (input.location !== undefined) dbFields.location = input.location;
  if (input.country !== undefined) dbFields.country = input.country;
  if (input.fieldOfStudy !== undefined) dbFields.field_of_study = input.fieldOfStudy;
  if (input.skills !== undefined) dbFields.skills = input.skills;
  if (input.interests !== undefined) dbFields.interests = input.interests;
  if (input.experience !== undefined) dbFields.experience = input.experience;
  if (input.portfolioUrl !== undefined) dbFields.portfolio_url = input.portfolioUrl;
  if (input.language !== undefined) dbFields.language = input.language;
  if (input.timezone !== undefined) dbFields.timezone = input.timezone;
  if (input.notificationPreferences !== undefined) {
    dbFields.notification_preferences = input.notificationPreferences;
  }

  // The structured level must never disagree with the qualification text the
  // student just edited. Only re-derived when the text changed and no explicit
  // level was sent in the same request.
  if (
    input.education !== undefined &&
    input.educationLevel === undefined
  ) {
    dbFields.education_level = levelFromEducationText(
      typeof input.education === "string" ? input.education : null,
    );
  }

  if (Object.keys(dbFields).length === 0) {
    // Nothing to update — return current profile
    return getProfile(userId);
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { auth_user_id: userId, ...dbFields },
      { onConflict: "auth_user_id" },
    )
    .select()
    .single();

  if (error) {
    throw new AppError(500, "PROFILE_UPDATE_FAILED", "Failed to update profile");
  }

  return mapProfileRow(data as ProfileRow);
}
