/**
 * Trustlify Backend — Gemini Provider Tests (Phase 3A)
 *
 * Fixture-based tests for the response parser, Zod schema validation,
 * and HTTP error mapping. These tests never call the real Gemini API —
 * the live smoke test is a separate script (npm run smoke:gemini).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeminiProvider,
  extractClaimsResponseSchema,
  parseGeminiResponseBody,
  mapGeminiHttpError,
  describeGeminiTransportFailure,
  isTransientGeminiError,
  MAX_GEMINI_REQUEST_ATTEMPTS,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function retryProvider() {
  return new GeminiProvider({ apiKey: "test-key", retryDelayMs: 0 });
}

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

describe("describeGeminiTransportFailure", () => {
  it("classifies timeout and abort failures without exposing transport details", () => {
    const timeout = Object.assign(new Error("socket 10.0.0.1 timed out"), {
      name: "TimeoutError",
    });
    expect(describeGeminiTransportFailure(timeout)).toBe("Gemini request timed out");
  });

  it("classifies native fetch network failures without exposing transport details", () => {
    const network = Object.assign(new TypeError("fetch failed for private-host"), {
      cause: { code: "ENOTFOUND" },
    });
    expect(describeGeminiTransportFailure(network)).toBe(
      "Gemini network request could not be completed",
    );
  });
});

describe("GeminiProvider transient retries", () => {
  it("retries 429 once and returns the successful claim extraction", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(apiResponse({ error: { message: "rate limited" } }, 429))
      .mockResolvedValueOnce(apiResponse(validApiResponse));
    vi.stubGlobal("fetch", fetchMock);

    const output = await retryProvider().extractClaims({ text: "Claim", inputType: "text" });

    expect(output.claims).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries each transient 5xx status once", async () => {
    for (const status of [500, 502, 503, 504]) {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(apiResponse({ error: { message: "temporary" } }, status))
        .mockResolvedValueOnce(apiResponse(validApiResponse));
      vi.stubGlobal("fetch", fetchMock);

      await expect(retryProvider().extractClaims({ text: "Claim", inputType: "text" })).resolves.toEqual(
        validModelOutput,
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.unstubAllGlobals();
    }
  });

  it("retries native network and timeout failures once", async () => {
    for (const error of [
      Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }),
      Object.assign(new Error("timed out"), { name: "TimeoutError" }),
    ]) {
      const fetchMock = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(apiResponse(validApiResponse));
      vi.stubGlobal("fetch", fetchMock);

      await expect(retryProvider().extractClaims({ text: "Claim", inputType: "text" })).resolves.toEqual(
        validModelOutput,
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.unstubAllGlobals();
    }
  });

  it("does not retry permanent HTTP errors", async () => {
    for (const status of [400, 401, 403, 404]) {
      const fetchMock = vi.fn().mockResolvedValue(apiResponse({ error: { message: "permanent" } }, status));
      vi.stubGlobal("fetch", fetchMock);

      await expect(retryProvider().extractClaims({ text: "Claim", inputType: "text" })).rejects.toBeInstanceOf(
        AIError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    }
  });

  it("stops after the configured maximum attempts for repeated transient errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse({ error: { message: "busy" } }, 503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryProvider().extractClaims({ text: "Claim", inputType: "text" })).rejects.toMatchObject({
      code: "AI_REQUEST_FAILED",
      httpStatus: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_GEMINI_REQUEST_ATTEMPTS);
  });

  it("does not retry a successful first request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(apiResponse(validApiResponse));
    vi.stubGlobal("fetch", fetchMock);

    await expect(retryProvider().extractClaims({ text: "Claim", inputType: "text" })).resolves.toEqual(
      validModelOutput,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("identifies only the intended failures as transient", () => {
    expect(isTransientGeminiError(new AIError("AI_RATE_LIMITED", "x", 429))).toBe(true);
    expect(isTransientGeminiError(new AIError("AI_REQUEST_FAILED", "x", 503))).toBe(true);
    expect(isTransientGeminiError(new AIError("AI_REQUEST_FAILED", "x"))).toBe(true);
    expect(isTransientGeminiError(new AIError("AI_REQUEST_FAILED", "x", 400))).toBe(false);
    expect(isTransientGeminiError(new AIError("AI_AUTH_FAILED", "x", 401))).toBe(false);
    expect(isTransientGeminiError(new AIError("AI_INVALID_MODEL", "x", 404))).toBe(false);
    expect(isTransientGeminiError(new AIError("AI_MALFORMED_OUTPUT", "x"))).toBe(false);
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
