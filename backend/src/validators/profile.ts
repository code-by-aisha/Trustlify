/**
 * Trustlify Backend — Profile Validators
 */

import { z } from "zod";

export const createProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(["student", "general"]).optional(),
  education: z.string().min(1).max(500).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  location: z.string().min(1).max(200).nullable().optional(),
  skills: z.array(z.string().min(1).max(100)).max(50).optional(),
  interests: z.array(z.string().min(1).max(100)).max(50).optional(),
  experience: z.string().min(1).max(2000).nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  education: z.string().min(1).max(500).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  location: z.string().min(1).max(200).nullable().optional(),
  skills: z.array(z.string().min(1).max(100)).max(50).optional(),
  interests: z.array(z.string().min(1).max(100)).max(50).optional(),
  experience: z.string().min(1).max(2000).nullable().optional(),
  portfolioUrl: z.string().url().nullable().optional(),
  language: z.string().min(1).max(50).optional(),
  timezone: z.string().min(1).max(100).optional(),
  notificationPreferences: z.record(z.boolean()).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
