/**
 * Trustlify Backend — Profile Validators
 */

import { z } from "zod";

export const createProfileSchema = z.object({
  education: z.string().min(1).max(500).optional(),
  age: z.number().int().min(1).max(120).optional(),
  location: z.string().min(1).max(200).optional(),
  skills: z.array(z.string().min(1).max(100)).max(50).optional(),
  interests: z.array(z.string().min(1).max(100)).max(50).optional(),
  experience: z.string().min(1).max(2000).optional(),
  portfolioUrl: z.string().url().optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
