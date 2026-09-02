/**
 * Trustlify Backend — Profile Validators
 *
 * Structured student fields (country / education level / field of study) were
 * added with the student-intelligence update. They are all optional and
 * nullable: a profile that only has the older free-text values stays valid and
 * keeps matching through the text fallback in profile/educationLevels.
 */

import { z } from "zod";
import { EDUCATION_LEVELS } from "../profile/educationLevels.js";

/** Blank input from the UI means "not recorded", never "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

const educationLevelField = z
  .enum(EDUCATION_LEVELS)
  .nullable()
  .optional();

/**
 * Skills and interests are free text the student owns, so the same entry can
 * arrive as "Python", "python" or " Python ". They are compared case
 * insensitively everywhere else (matcher, recommendation queries), so the API
 * collapses the spellings once, at the door, keeping the first wording the
 * student used. A blank entry means "nothing recorded" and is dropped rather
 * than rejected, because the chip UI can legitimately send one while clearing.
 */
const skillList = (max: number) =>
  z
    .array(z.string().trim().max(100))
    .max(max)
    .transform((items) => {
      const seen = new Set<string>()
      return items.filter((item) => {
        const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
    });

export const createProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(["student", "general"]).optional(),
  education: z.string().min(1).max(500).nullable().optional(),
  educationLevel: educationLevelField,
  age: z.number().int().min(1).max(120).nullable().optional(),
  location: z.string().min(1).max(200).nullable().optional(),
  country: optionalText(120),
  fieldOfStudy: optionalText(200),
  skills: skillList(50).optional(),
  interests: skillList(50).optional(),
  experience: z.string().min(1).max(2000).nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  education: z.string().min(1).max(500).nullable().optional(),
  educationLevel: educationLevelField,
  age: z.number().int().min(1).max(120).nullable().optional(),
  location: z.string().min(1).max(200).nullable().optional(),
  country: optionalText(120),
  fieldOfStudy: optionalText(200),
  skills: skillList(50).optional(),
  interests: skillList(50).optional(),
  experience: z.string().min(1).max(2000).nullable().optional(),
  // Optional public portfolio / profile link. Validated as a real URL, and
  // treated strictly as untrusted public content wherever it is read.
  portfolioUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
  language: z.string().min(1).max(50).optional(),
  timezone: z.string().min(1).max(100).optional(),
  notificationPreferences: z.record(z.boolean()).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
