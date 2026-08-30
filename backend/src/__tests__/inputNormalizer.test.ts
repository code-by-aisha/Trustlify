/**
 * Trustlify Backend — Input Normalizer Tests (Phase 3C)
 *
 * Spec section 26, categories:
 *   1. valid text input
 *   2. valid URL input
 *   3. invalid URL
 *   4. empty input
 *
 * Fixture-based only — no network, no Supabase, no AI calls.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeInvestigationInput,
  normalizedInputSchema,
  InputValidationError,
} from "../investigation/inputNormalizer.js";

const SPEC_INPUT =
  "The XYZ scholarship is fully funded and applications close on September 15, 2026.";

/* ─── 1. Valid text input ─────────────────────────────────────────────────── */

describe("category 1 — valid text input", () => {
  it("normalizes a valid text input", () => {
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: SPEC_INPUT,
    });

    expect(result.type).toBe("text");
    expect(result.content).toBe(SPEC_INPUT);
    expect(result.sourceUrl).toBeNull();
    expect(result.fileId).toBeNull();
    expect(result.metadata.contentLength).toBe(SPEC_INPUT.length);
    expect(result.metadata.preview.length).toBeGreaterThan(0);
  });

  it("trims surrounding whitespace from text input", () => {
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: `  ${SPEC_INPUT}  `,
    });
    expect(result.content).toBe(SPEC_INPUT);
  });

  it("truncates long previews but keeps full content", () => {
    const long = "A".repeat(500);
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: long,
    });
    expect(result.content).toBe(long);
    expect(result.metadata.preview.length).toBeLessThanOrEqual(121); // 120 + ellipsis
  });

  it("rejects text over the 10,000 character limit", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "text", inputText: "A".repeat(10_001) }),
    ).toThrow(InputValidationError);
  });

  it("treats copied message content as plain untrusted text (no separate pipeline)", () => {
    const message =
      "WhatsApp forward: Deadline extended to Aug 30, send CNIC to apply";
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: message,
    });
    expect(result.type).toBe("text");
    expect(result.content).toBe(message);
  });

  it("output always passes the normalizedInputSchema", () => {
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: SPEC_INPUT,
    });
    expect(normalizedInputSchema.safeParse(result).success).toBe(true);
  });
});

/* ─── 2. Valid URL input ──────────────────────────────────────────────────── */

describe("category 2 — valid URL input", () => {
  it("normalizes a valid https URL", () => {
    const result = normalizeInvestigationInput({
      inputType: "url",
      inputText: "https://example.com/scholarship-2026",
    });

    expect(result.type).toBe("url");
    expect(result.sourceUrl).toBe("https://example.com/scholarship-2026");
    expect(result.content).toBe("https://example.com/scholarship-2026");
    expect(result.metadata.hostname).toBe("example.com");
  });

  it("normalizes a valid http URL", () => {
    const result = normalizeInvestigationInput({
      inputType: "url",
      inputText: "http://example.org/apply",
    });
    expect(result.sourceUrl).toBe("http://example.org/apply");
  });

  it("rejects non-http(s) schemes (SSRF protection intact)", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "ftp://example.com/file" }),
    ).toThrow(InputValidationError);
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "file:///etc/passwd" }),
    ).toThrow(InputValidationError);
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "javascript:alert(1)" }),
    ).toThrow(InputValidationError);
  });

  it("rejects private/internal hostnames (SSRF protection intact)", () => {
    for (const unsafe of [
      "http://localhost:3000/api/investigations",
      "http://127.0.0.1/admin",
      "http://192.168.1.1/router",
      "http://10.0.0.5/internal",
      "http://intranet.local/dashboard",
    ]) {
      expect(() =>
        normalizeInvestigationInput({ inputType: "url", inputText: unsafe }),
      ).toThrow(InputValidationError);
    }
  });
});

/* ─── 3. Invalid URL ──────────────────────────────────────────────────────── */

describe("category 3 — invalid URL", () => {
  it("rejects a malformed URL", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "not a url" }),
    ).toThrow(InputValidationError);
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "http://" }),
    ).toThrow(InputValidationError);
  });

  it("rejects whitespace-only URL input", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "url", inputText: "   " }),
    ).toThrow(InputValidationError);
  });

  it("rejects a URL when inputText is missing entirely", () => {
    expect(() => normalizeInvestigationInput({ inputType: "url" })).toThrow(
      InputValidationError,
    );
  });
});

/* ─── 4. Empty input ──────────────────────────────────────────────────────── */

describe("category 4 — empty input", () => {
  it("rejects empty text input", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "text", inputText: "" }),
    ).toThrow(InputValidationError);
  });

  it("rejects whitespace-only text input", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "text", inputText: "   \n\t " }),
    ).toThrow(InputValidationError);
  });

  it("rejects text input with no inputText at all", () => {
    expect(() => normalizeInvestigationInput({ inputType: "text" })).toThrow(
      InputValidationError,
    );
  });
});

/* ─── Image/PDF interface boundary (spec 03/24) ───────────────────────────── */

describe("image/pdf interface boundary", () => {
  it("accepts an image input with a file path (interface only)", () => {
    const result = normalizeInvestigationInput({
      inputType: "image",
      inputFilePath: "uploads/abc/screenshot.png",
    });
    expect(result.type).toBe("image");
    expect(result.content).toBeNull();
    expect(result.fileId).toBe("uploads/abc/screenshot.png");
  });

  it("accepts a pdf input with a file path (interface only)", () => {
    const result = normalizeInvestigationInput({
      inputType: "pdf",
      inputFilePath: "uploads/abc/doc.pdf",
    });
    expect(result.type).toBe("pdf");
    expect(result.content).toBeNull();
  });

  it("rejects image/pdf input without a file path", () => {
    expect(() => normalizeInvestigationInput({ inputType: "image" })).toThrow(
      InputValidationError,
    );
    expect(() => normalizeInvestigationInput({ inputType: "pdf" })).toThrow(
      InputValidationError,
    );
  });
});
