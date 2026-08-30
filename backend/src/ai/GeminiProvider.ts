/**
 * Trustlify Backend — Gemini Provider
 *
 * Phase 3A: implements AIProvider.extractClaims() with a real Gemini API call
 * using strict JSON structured output. All other methods remain NOT_IMPLEMENTED
 * (Phase 3B+).
 *
 * Environment variables:
 *   GEMINI_API_KEY  — required at call time (never logged, never sent to frontend)
 *   GEMINI_MODEL    — defaults to "gemini-3.6-flash"
 *     (Note: gemini-2.5-flash was deprecated by the API — it now returns 404
 *      "no longer available to new users" and the API recommends gemini-3.6-flash.)
 *
 * Security:
 *   - API key is sent via the x-goog-api-key header (never in the URL)
 *   - Error messages are scrubbed of the API key before surfacing
 *   - No retry loops, no fallback models — exactly one request per call
 */

import { z } from "zod";
import { env } from "../config/env.js";
import { AIError } from "./errors.js";
import type {
  AIProvider,
  ExtractClaimsInput,
  ExtractClaimsOutput,
  PlanSearchInput,
  PlanSearchOutput,
  AnalyzeEvidenceInput,
  AnalyzeEvidenceOutput,
  VerifyClaimsInput,
  VerifyClaimsOutput,
  AnalyzeImageInput,
  AnalyzeImageOutput,
  MatchStudentInput,
  ExplainDecisionInput,
  LocalizeInput,
} from "./AIProvider.js";
import type { StudentMatch } from "../types/investigation.js";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/* ─── Claim taxonomy (mirrors types/investigation.ts) ─────────────────────── */

const CLAIM_TYPES = [
  "organization",
  "opportunity",
  "deadline",
  "current_status",
  "funding",
  "fee",
  "eligibility",
  "application_url",
  "data_request",
  "location",
  "contact",
  "other",
] as const;

const CLAIM_IMPORTANCE = ["critical", "important", "supporting"] as const;

/* ─── Response schema — Zod (validation) ──────────────────────────────────── */

export const extractClaimsResponseSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().min(1),
        type: z.enum(CLAIM_TYPES),
        importance: z.enum(CLAIM_IMPORTANCE),
      }),
    )
    .min(1),
});

/* ─── Response schema — Gemini API (structured output contract) ───────────── */

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    claims: {
      type: "ARRAY",
      description: "Every distinct factual claim extracted from the input.",
      items: {
        type: "OBJECT",
        properties: {
          text: {
            type: "STRING",
            description: "The claim as a single self-contained factual statement.",
          },
          type: {
            type: "STRING",
            enum: [...CLAIM_TYPES],
            description:
              "Category of the claim. Use 'funding' for scholarships/costs, 'deadline' for dates, 'organization' for named entities, 'opportunity' for what is offered.",
          },
          importance: {
            type: "STRING",
            enum: [...CLAIM_IMPORTANCE],
            description:
              "'critical' if the claim being false would significantly change a decision, 'important' if materially relevant, 'supporting' otherwise.",
          },
        },
        required: ["text", "type", "importance"],
      },
    },
  },
  required: ["claims"],
} as const;

/* ─── Helpers (pure, exported for testing) ────────────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Extract the safe, truncated error message from a Gemini error response body.
 */
export function extractApiErrorMessage(body: unknown): string {
  const error = asRecord(asRecord(body)?.error);
  const message = typeof error?.message === "string" ? error.message : "";
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

/**
 * Map a Gemini HTTP error status/body to a safe AIError.
 * Never includes the API key or the full request URL.
 */
export function mapGeminiHttpError(status: number, body: unknown): AIError {
  const apiMessage = extractApiErrorMessage(body);

  if (status === 401 || status === 403) {
    return new AIError(
      "AI_AUTH_FAILED",
      "Gemini authentication failed — check the API key",
      status,
    );
  }
  if (status === 404) {
    return new AIError(
      "AI_INVALID_MODEL",
      "Gemini model not found — check GEMINI_MODEL",
      status,
    );
  }
  if (status === 429) {
    return new AIError(
      "AI_RATE_LIMITED",
      "Gemini rate limit exceeded — try again later",
      status,
    );
  }
  if (status === 400 && /api key/i.test(apiMessage)) {
    return new AIError(
      "AI_AUTH_FAILED",
      "Gemini authentication failed — check the API key",
      status,
    );
  }
  return new AIError(
    "AI_REQUEST_FAILED",
    `Gemini request failed with status ${status}${apiMessage ? `: ${apiMessage}` : ""}`,
    status,
  );
}

/**
 * Parse and validate a Gemini generateContent response body against the
 * claim-extraction schema. Throws AIError("AI_MALFORMED_OUTPUT") when the
 * response is blocked, empty, non-JSON, or schema-invalid.
 */
export function parseGeminiResponseBody(body: unknown): ExtractClaimsOutput {
  const record = asRecord(body);

  const promptFeedback = asRecord(record?.promptFeedback);
  const blockReason = promptFeedback?.blockReason;
  if (typeof blockReason === "string") {
    throw new AIError(
      "AI_MALFORMED_OUTPUT",
      `Gemini blocked the prompt (blockReason: ${blockReason})`,
    );
  }

  const candidates = Array.isArray(record?.candidates) ? record.candidates : [];
  const first = asRecord(candidates[0]);
  const content = asRecord(first?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];

  const text = parts
    .map((part) => {
      const text = asRecord(part)?.text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();

  if (!text) {
    const finishReason = first?.finishReason;
    throw new AIError(
      "AI_MALFORMED_OUTPUT",
      typeof finishReason === "string"
        ? `Gemini returned no content (finishReason: ${finishReason})`
        : "Gemini returned no content",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AIError("AI_MALFORMED_OUTPUT", "Gemini returned invalid JSON");
  }

  const result = extractClaimsResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIError(
      "AI_MALFORMED_OUTPUT",
      "Gemini output failed schema validation",
      undefined,
      {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    );
  }

  return result.data;
}

/**
 * Build the claim-extraction prompt for a given input.
 */
export function buildExtractClaimsPrompt(input: ExtractClaimsInput): string {
  const languageNote =
    input.language && input.language.toLowerCase() !== "english"
      ? `\nRespond in English regardless of the input language (${input.language}).`
      : "";

  return [
    "You are a precise claim extractor for a fact-checking system.",
    "Extract every distinct factual claim from the input text.",
    "For each claim, classify its type and importance according to the response schema.",
    "Each claim must be a single self-contained factual statement.",
    "Do not include opinions, questions, or restatements of the same claim.",
    `Input type: ${input.inputType}`,
    languageNote,
    "Input text:",
    '"""',
    input.text,
    '"""',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/* ─── Provider ────────────────────────────────────────────────────────────── */

export interface GeminiProviderConfig {
  /** Overrides env GEMINI_API_KEY (used by tests and alternate deployments). */
  apiKey?: string;
  /** Overrides env GEMINI_MODEL. Defaults to "gemini-3.6-flash". */
  model?: string;
  /** Overrides the Gemini REST base URL (used by tests and proxies). */
  baseUrl?: string;
}

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  public readonly model: string;

  constructor(config: GeminiProviderConfig = {}) {
    this.apiKey = config.apiKey ?? env.GEMINI_API_KEY ?? "";
    this.model = (config.model ?? env.GEMINI_MODEL ?? "") || DEFAULT_GEMINI_MODEL;
    this.baseUrl = (config.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Extract discrete claims from raw input using Gemini structured output.
   * Makes exactly one API request — no retries, no fallbacks.
   */
  async extractClaims(input: ExtractClaimsInput): Promise<ExtractClaimsOutput> {
    if (!this.apiKey) {
      throw new AIError(
        "AI_NOT_CONFIGURED",
        "Gemini API key is not configured — set GEMINI_API_KEY",
      );
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: buildExtractClaimsPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
      },
    };

    const body = await this.request(requestBody);
    return parseGeminiResponseBody(body);
  }

  /**
   * Perform a single Gemini generateContent request.
   * The API key travels in the x-goog-api-key header — never in the URL.
   */
  private async request(requestBody: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify(requestBody),
        },
      );
    } catch {
      // Network failure — never include the URL or key in the message
      throw new AIError("AI_REQUEST_FAILED", "Gemini request could not be completed");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let parsedBody: unknown = undefined;
      try {
        parsedBody = text ? JSON.parse(text) : undefined;
      } catch {
        parsedBody = undefined;
      }
      throw this.scrub(mapGeminiHttpError(response.status, parsedBody));
    }

    try {
      return await response.json();
    } catch {
      throw new AIError("AI_MALFORMED_OUTPUT", "Gemini returned a non-JSON body");
    }
  }

  /**
   * Defense-in-depth: remove any accidental occurrence of the API key
   * from an error message before it is surfaced or logged.
   */
  private scrub(error: AIError): AIError {
    if (!this.apiKey || !error.message.includes(this.apiKey)) {
      return error;
    }
    return new AIError(
      error.code,
      error.message.split(this.apiKey).join("[REDACTED]"),
      error.httpStatus,
      error.details,
    );
  }

  /* ─── Not yet implemented (Phase 3B+) ─────────────────────────────────── */

  async planSearch(_input: PlanSearchInput): Promise<PlanSearchOutput> {
    throw new Error("GeminiProvider.planSearch: NOT_IMPLEMENTED — Phase 3B");
  }

  async analyzeEvidence(_input: AnalyzeEvidenceInput): Promise<AnalyzeEvidenceOutput> {
    throw new Error("GeminiProvider.analyzeEvidence: NOT_IMPLEMENTED — Phase 3B");
  }

  async verifyClaims(_input: VerifyClaimsInput): Promise<VerifyClaimsOutput> {
    throw new Error("GeminiProvider.verifyClaims: NOT_IMPLEMENTED — Phase 3B");
  }

  async analyzeImage(_input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
    throw new Error("GeminiProvider.analyzeImage: NOT_IMPLEMENTED — Phase 3B");
  }

  async matchStudent(_input: MatchStudentInput): Promise<StudentMatch> {
    throw new Error("GeminiProvider.matchStudent: NOT_IMPLEMENTED — Phase 3B");
  }

  async explainDecision(_input: ExplainDecisionInput): Promise<string> {
    throw new Error("GeminiProvider.explainDecision: NOT_IMPLEMENTED — Phase 3B");
  }

  async localize(_input: LocalizeInput): Promise<string> {
    throw new Error("GeminiProvider.localize: NOT_IMPLEMENTED — Phase 3B");
  }
}
