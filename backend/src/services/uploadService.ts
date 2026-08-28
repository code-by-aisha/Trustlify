/**
 * Trustlify Backend — Upload Service
 *
 * Phase 1: Validates upload metadata. Does not store files permanently.
 * Phase 2: Will use Supabase Storage.
 */

import { v4 as uuidv4 } from "uuid";
import type { UploadMetadataInput } from "../validators/upload.js";
import type { Upload } from "../types/investigation.js";

/**
 * Validate and register an upload.
 * Phase 2: Will persist file to Supabase Storage and record in uploads table.
 */
export async function registerUpload(
  _userId: string,
  metadata: UploadMetadataInput,
): Promise<Pick<Upload, "id" | "contentType" | "size">> {
  // Phase 1: Validate metadata only — no permanent storage
  const id = uuidv4();
  return {
    id,
    contentType: metadata.contentType,
    size: metadata.size,
  };
}
