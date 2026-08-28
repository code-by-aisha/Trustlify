/**
 * Trustlify Backend — Upload Validators
 */

import { z } from "zod";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadMetadataSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Filename may only contain letters, numbers, dots, hyphens, and underscores",
    ),
  contentType: z
    .string()
    .refine(
      (type) => ALLOWED_MIME_TYPES.has(type),
      "Only JPEG, PNG, WebP images and PDF files are allowed",
    ),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, "File size must not exceed 10 MB"),
});

export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;

/**
 * Sanitize a user-supplied filename to prevent path traversal.
 */
export function sanitizeFilename(raw: string): string {
  // Remove path separators and null bytes
  const cleaned = raw.replace(/[/\\%00]/g, "").trim();
  // Limit length
  return cleaned.slice(0, 255) || "unnamed";
}
