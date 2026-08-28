/**
 * Trustlify Backend — Common Validators
 *
 * Shared Zod schemas used across multiple routes.
 */

import { z } from "zod";

/** Pagination query parameters */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Standard UUID-like ID parameter */
export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required").max(255),
});

/** Reject client-supplied verdicts, trust scores, roles */
export const noTrustFromClient = z.never().optional();
