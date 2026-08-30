/**
 * Trustlify Backend — Input Normalizer
 *
 * Phase 3C: unified normalized input model for investigations.
 *
 * All user input (text, URL, image, PDF, copied message) is normalized into a
 * single shape before entering the pipeline. Client-supplied type values are
 * NEVER trusted without Zod validation. URLs are validated against the
 * existing SSRF protection (utils/urls) — do not weaken it.
 *
 * Future architecture (Phase 4+):
 *
 *   InputNormalizer → InputType → ContentExtractor → Claims
 *
 * Image/PDF inputs are accepted and validated here (interface boundary) but
 * content extraction for them arrives in a later phase; the mini pipeline
 * rejects their execution with a clear, honest error.
 */

import { z } from "zod";
import { urlInputSchema, parseUrlInfo } from "../utils/urls.js";

/* ─── Normalized input model ──────────────────────────────────────────────── */

export const normalizedInputTypeSchema = z.enum([
  "text",
  "url",
  "image",
  "pdf",
  "message",
]);

export type NormalizedInputType = z.infer<typeof normalizedInputTypeSchema>;

export interface NormalizedInput {
  type: NormalizedInputType;
  /** Extracted plain content. Null for file inputs until extraction exists. */
  content: string | null;
  /** The submitted URL when type is 'url'. Null otherwise. */
  sourceUrl: string | null;
  /** Storage path of an uploaded file when type is 'image'/'pdf'. */
  fileId: string | null;
  /** Deterministic metadata derived from the input (never client-supplied). */
  metadata: {
    hostname?: string;
    contentLength?: number;
    /** Short, safe preview for UI display. */
    preview: string;
  };
}

export const normalizedInputSchema = z.object({
  type: normalizedInputTypeSchema,
  content: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  fileId: z.string().nullable(),
  metadata: z.object({
    hostname: z.string().optional(),
    contentLength: z.number().int().nonnegative().optional(),
    preview: z.string(),
  }),
});

/* ─── Limits ──────────────────────────────────────────────────────────────── */

const MAX_TEXT_LENGTH = 10_000;
const PREVIEW_LENGTH = 120;

/* ─── Normalization ───────────────────────────────────────────────────────── */

/**
 * Copied messages/emails are treated as plain untrusted text — no separate
 * per-platform pipelines. Everything enters through the same normalizer.
 */
export interface NormalizeInvestigationInputArgs {
  inputType: "url" | "text" | "image" | "pdf";
  inputText?: string;
  inputFilePath?: string;
}

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

function buildPreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > PREVIEW_LENGTH
    ? `${collapsed.slice(0, PREVIEW_LENGTH)}…`
    : collapsed;
}

/**
 * Normalize raw investigation input into the unified model.
 * Throws InputValidationError on empty input, malformed/private URLs,
 * missing file references, or oversized content.
 */
export function normalizeInvestigationInput(
  args: NormalizeInvestigationInputArgs,
): NormalizedInput {
  const { inputType } = args;

  if (inputType === "url") {
    const raw = (args.inputText ?? "").trim();
    if (!raw) {
      throw new InputValidationError("URL input requires a non-empty inputText");
    }
    // Full SSRF protection: http(s) only, no private/internal hostnames.
    const urlResult = urlInputSchema.safeParse(raw);
    if (!urlResult.success) {
      throw new InputValidationError(
        urlResult.error.issues[0]?.message ?? "Invalid or unsafe URL",
      );
    }
    const info = parseUrlInfo(urlResult.data);
    return {
      type: "url",
      content: urlResult.data,
      sourceUrl: urlResult.data,
      fileId: null,
      metadata: {
        hostname: info?.hostname,
        contentLength: urlResult.data.length,
        preview: buildPreview(urlResult.data),
      },
    };
  }

  if (inputType === "text") {
    const raw = (args.inputText ?? "").trim();
    if (!raw) {
      throw new InputValidationError("Text input requires a non-empty inputText");
    }
    if (raw.length > MAX_TEXT_LENGTH) {
      throw new InputValidationError(
        `Text input exceeds the ${MAX_TEXT_LENGTH} character limit`,
      );
    }
    return {
      type: "text",
      content: raw,
      sourceUrl: null,
      fileId: null,
      metadata: {
        contentLength: raw.length,
        preview: buildPreview(raw),
      },
    };
  }

  // image / pdf — interface boundary only; extraction arrives in Phase 4.
  const filePath = (args.inputFilePath ?? "").trim();
  if (!filePath) {
    throw new InputValidationError(
      `${inputType} input requires an inputFilePath`,
    );
  }
  return {
    type: inputType,
    content: null,
    sourceUrl: null,
    fileId: filePath,
    metadata: {
      preview: buildPreview(filePath),
    },
  };
}
