/**
 * Trustlify Backend — Gemini Provider Tests (Phase 3A)
 *
 * Fixture-based tests for the response parser, Zod schema validation,
 * and HTTP error mapping. These tests never call the real Gemini API —
 * the live smoke test is a separate script (npm run smoke:gemini).
 */

import { describe, it, expect } from "vitest";
import {
  GeminiProvider,
  extractClaimsResponseSchema,
  parseGeminiResponseBody,
  mapGeminiHttpError,
  buildExtractClaimsPrompt,
} from "../ai/GeminiProvider.js";
import { AIError } from "../ai/errors.js";

/* ─── Fixtures ────────────────────────────────────────────────────────────── */

const validModelOutput = {
  claims: [
    {
      text: "XYZ scholarship is fully funded",
      type: "funding",
      importance: "critical",
    },
    {
      text: "Applications close on September 15, 2026",
      type: "deadline",
      importance: "critical",
    },
  ],
};

const validApiResponse = {
  candidates: [
    {
      content: {
        parts: [{ text: JSON.stringify(validModelOutput) }],
        role: "model",
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 50,
    totalTokenCount: 150,
  },
  modelVersion: "models/gemini-2.5-flash",
};

/* ─── Zod schema ──────────────────────────────────────────────────────────── */

describe("extractClaimsResponseSchema", () => {
  it("accepts a valid claim extraction response", () => {
    const result = extractClaimsResponseSchema.safeParse(validModelOutput);
    expect(result.success).toBe(true);
  });

  it("rejects a response missing the claims array", () => {
    const result = extractClaimsResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty claims array", () => {
    const result = extractClaimsResponseSchema.safeParse({ claims: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown claim type", () => {
    const result = extractClaimsResponseSchema.safeParse({
      claims: [{ text: "Claim", type: "factual", importance: "critical" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown importance value", () => {
    const result = extractClaimsResponseSchema.safeParse({
      claims: [{ text: "Claim", type: "funding", importance: "very-high" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty claim text", () => {
    const result = extractClaimsResponseSchema.safeParse({
      claims: [{ text: "", type: "funding", importance: "critical" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a claim missing a required field", () => {
    const result = extractClaimsResponseSchema.safeParse({
      claims: [{ text: "Claim", type: "funding" }],
    });
    expect(result.success).toBe(false);
  });
});

/* ─── Gemini response body parser ─────────────────────────────────────────── */

describe("parseGeminiResponseBody", () => {
  it("parses a valid generateContent response", () => {
    const output = parseGeminiResponseBody(validApiResponse);
    expect(output.claims).toHaveLength(2);
    expect(output.claims[0]).toEqual({
      text: "XYZ scholarship is fully funded",
      type: "funding",
      importance: "critical",
    });
    expect(output.claims[1]).toEqual({
      text: "Applications close on September 15, 2026",
      type: "deadline",
      importance: "critical",
    });
  });

  it("joins multiple text parts before parsing", () => {
    const split = {
      candidates: [
        {
          content: {
            parts: [
              { text: '{"claims":[{"text":"Claim one","type' },
              { text: '":"other","importance":"supporting"}]}' },
            ],
          },
        },
      ],
    };
    const output = parseGeminiResponseBody(split);
    expect(output.claims).toHaveLength(1);
    expect(output.claims[0].text).toBe("Claim one");
  });

  it("throws AI_MALFORMED_OUTPUT when the prompt is blocked", () => {
    const blocked = { promptFeedback: { blockReason: "SAFETY" } };
    expect(() => parseGeminiResponseBody(blocked)).toThrowError(AIError);
    try {
      parseGeminiResponseBody(blocked);
    } catch (err) {
      expect((err as AIError).code).toBe("AI_MALFORMED_OUTPUT");
      expect((err as AIError).message).toContain("SAFETY");
    }
  });

  it("throws AI_MALFORMED_OUTPUT when there are no candidates", () => {
    expect(() => parseGeminiResponseBody({})).toThrowError(AIError);
    try {
      parseGeminiResponseBody({});
    } catch (err) {
      expect((err as AIError).code).toBe("AI_MALFORMED_OUTPUT");
    }
  });

  it("reports finishReason when the candidate has no content", () => {
    const noContent = { candidates: [{ finishReason: "SAFETY" }] };
    try {
      parseGeminiResponseBody(noContent);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AIError).code).toBe("AI_MALFORMED_OUTPUT");
      expect((err as AIError).message).toContain("SAFETY");
    }
  });

  it("throws AI_MALFORMED_OUTPUT when the model text is not JSON", () => {
    const notJson = {
      candidates: [{ content: { parts: [{ text: "not json at all" }] } }],
    };
    try {
      parseGeminiResponseBody(notJson);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AIError).code).toBe("AI_MALFORMED_OUTPUT");
      expect((err as AIError).message).toContain("invalid JSON");
    }
  });

  it("throws AI_MALFORMED_OUTPUT when JSON does not match the schema", () => {
    const wrongShape = {
      candidates: [{ content: { parts: [{ text: '{"claims": "nope"}' }] } }],
    };
    try {
      parseGeminiResponseBody(wrongShape);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AIError).code).toBe("AI_MALFORMED_OUTPUT");
      expect((err as AIError).message).toContain("schema validation");
    }
  });
});

/* ─── HTTP error mapping ──────────────────────────────────────────────────── */

describe("mapGeminiHttpError", () => {
  it("maps 401 to AI_AUTH_FAILED", () => {
    const err = mapGeminiHttpError(401, {});
    expect(err.code).toBe("AI_AUTH_FAILED");
    expect(err.httpStatus).toBe(401);
  });

  it("maps 403 to AI_AUTH_FAILED", () => {
    const err = mapGeminiHttpError(403, {});
    expect(err.code).toBe("AI_AUTH_FAILED");
  });

  it("maps 400 with an API key message to AI_AUTH_FAILED", () => {
    const err = mapGeminiHttpError(400, {
      error: { code: 400, message: "API key not valid. Please pass a valid API key." },
    });
    expect(err.code).toBe("AI_AUTH_FAILED");
  });

  it("maps 404 to AI_INVALID_MODEL", () => {
    const err = mapGeminiHttpError(404, {
      error: { code: 404, message: "models/gemini-bogus is not found" },
    });
    expect(err.code).toBe("AI_INVALID_MODEL");
  });

  it("maps 429 to AI_RATE_LIMITED", () => {
    const err = mapGeminiHttpError(429, {});
    expect(err.code).toBe("AI_RATE_LIMITED");
  });

  it("maps 500 to AI_REQUEST_FAILED", () => {
    const err = mapGeminiHttpError(500, {});
    expect(err.code).toBe("AI_REQUEST_FAILED");
    expect(err.httpStatus).toBe(500);
  });

  it("includes a truncated API message for other errors", () => {
    const long = "x".repeat(300);
    const err = mapGeminiHttpError(503, {
      error: { message: long },
    });
    expect(err.code).toBe("AI_REQUEST_FAILED");
    expect(err.message).toContain("503");
    expect(err.message.length).toBeLessThan(300);
  });

  it("never includes the request URL or credentials", () => {
    const err = mapGeminiHttpError(400, {
      error: { message: "Malformed request" },
    });
    expect(err.message).not.toContain("generativelanguage");
    expect(err.message).not.toContain("key=");
  });
});

/* ─── Provider configuration guard ────────────────────────────────────────── */

describe("GeminiProvider configuration", () => {
  it("rejects extractClaims when the API key is missing", async () => {
    const provider = new GeminiProvider({ apiKey: "" });
    await expect(provider.extractClaims({ text: "test", inputType: "text" }))
      .rejects.toMatchObject({
        code: "AI_NOT_CONFIGURED",
      });
  });

  it("uses the default model when none is configured", () => {
    const provider = new GeminiProvider({ apiKey: "test-key", model: "" });
    expect(provider.model).toBe("gemini-3.6-flash");
  });

  it("exposes the configured model for reporting", () => {
    const provider = new GeminiProvider({ apiKey: "k", model: "gemini-2.5-pro" });
    expect(provider.model).toBe("gemini-2.5-pro");
  });
});

/* ─── Prompt builder ──────────────────────────────────────────────────────── */

describe("buildExtractClaimsPrompt", () => {
  it("includes the input text and taxonomy instructions", () => {
    const prompt = buildExtractClaimsPrompt({
      text: "The XYZ scholarship is fully funded.",
      inputType: "text",
    });
    expect(prompt).toContain("The XYZ scholarship is fully funded.");
    expect(prompt).toContain("Input type: text");
    expect(prompt).toContain("claim extractor");
  });

  it("adds a language note for non-English input", () => {
    const prompt = buildExtractClaimsPrompt({
      text: "Une bourse est entièrement financée.",
      inputType: "text",
      language: "French",
    });
    expect(prompt).toContain("French");
  });
});
