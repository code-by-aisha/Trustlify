/**
 * Trustlify Backend — Upload Service
 *
 * Phase 2: Supabase Storage for file uploads.
 * Files go to the private 'trustlify-uploads' bucket.
 * Path model: user_id/investigation_id/file
 */

import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";
import { sanitizeFilename } from "../validators/upload.js";

const BUCKET = "trustlify-uploads";
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export interface UploadInput {
  filename: string;
  contentType: string;
  size: number;
  fileBuffer?: Buffer;
  investigationId?: string;
}

/**
 * Register and store an upload.
 */
export async function registerUpload(
  userId: string,
  input: UploadInput,
) {
  // Validate MIME
  if (!ALLOWED_MIME.has(input.contentType)) {
    throw new AppError(400, "INVALID_MIME", `Unsupported file type: ${input.contentType}`);
  }

  // Validate size
  if (input.size > MAX_SIZE_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", `File size exceeds the ${MAX_SIZE_BYTES / 1024 / 1024}MB limit`);
  }

  const safeName = sanitizeFilename(input.filename);
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
  const storageFilename = `${uuidv4()}${ext ? "." + ext : ""}`;

  // Build storage path: user_id/investigation_id/file
  const folder = input.investigationId
    ? `${userId}/${input.investigationId}`
    : userId;
  const storagePath = `${folder}/${storageFilename}`;

  // Upload to Supabase Storage if buffer provided
  if (input.fileBuffer) {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, input.fileBuffer, {
        contentType: input.contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new AppError(500, "UPLOAD_FAILED", "Failed to store file");
    }
  }

  // Persist metadata to uploads table
  const { data: record, error: dbError } = await supabaseAdmin
    .from("uploads")
    .insert({
      user_id: userId,
      investigation_id: input.investigationId ?? null,
      storage_path: storagePath,
      original_filename: safeName,
      content_type: input.contentType,
      size_bytes: input.size,
    })
    .select("id, content_type, size_bytes, storage_path")
    .single();

  if (dbError) {
    throw new AppError(500, "UPLOAD_RECORD_FAILED", "Failed to record upload metadata");
  }

  return {
    id: record.id,
    contentType: record.content_type,
    size: Number(record.size_bytes),
    storagePath: record.storage_path,
  };
}

/**
 * Get upload metadata by ID (verifies ownership).
 */
export async function getUpload(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("uploads")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError(404, "NOT_FOUND", "Upload not found");
  }

  return {
    id: data.id,
    userId: data.user_id,
    investigationId: data.investigation_id,
    storagePath: data.storage_path,
    originalFilename: data.original_filename,
    contentType: data.content_type,
    size: Number(data.size_bytes),
    createdAt: data.created_at,
  };
}
