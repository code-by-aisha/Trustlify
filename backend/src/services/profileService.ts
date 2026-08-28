/**
 * Trustlify Backend — Profile Service
 *
 * Phase 1: Placeholder. Database integration in Phase 2.
 */

import type { StudentProfile } from "../types/investigation.js";
import type { CreateProfileInput } from "../validators/profile.js";

/**
 * Create or update a student profile.
 * Phase 2: Will persist to Supabase profiles table.
 */
export async function createProfile(
  _userId: string,
  _input: CreateProfileInput,
): Promise<StudentProfile> {
  // TODO Phase 2: Persist to Supabase
  throw new Error("profileService.createProfile: NOT_IMPLEMENTED — Phase 2 (requires Supabase)");
}

/**
 * Get a student profile by user ID.
 * Phase 2: Will read from Supabase profiles table.
 */
export async function getProfile(
  _userId: string,
): Promise<StudentProfile | null> {
  // TODO Phase 2: Read from Supabase
  throw new Error("profileService.getProfile: NOT_IMPLEMENTED — Phase 2 (requires Supabase)");
}
