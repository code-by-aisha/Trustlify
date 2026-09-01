/**
 * Trustlify — Combined input focused tests (student intelligence update spec 19)
 *
 * Covers the three input paths this update touches: text on its own must behave
 * exactly as before, text plus an image must BOTH survive normalization, and a
 * URL plus an optional question must keep the two fields separate.
 */

import { describe, it, expect } from "vitest";
import { normalizeInvestigationInput } from "../investigation/inputNormalizer.js";
import { classifyQuestionIntent } from "../investigation/questionIntent.js";
import {
  MAX_QUESTION_LENGTH,
  createInvestigationSchema,
} from "../validators/investigation.js";

/* ─── 1. Text only — unchanged behaviour ──────────────────────────────────── */

describe("text input on its own still works", () => {
  it("keeps text input as the content with no file reference", () => {
    const result = normalizeInvestigationInput({
      inputType: "text",
      inputText: "HEC Research Fellowship 2026 — open to Pakistani students",
    });

    expect(result.type).toBe("text");
    expect(result.content).toBe("HEC Research Fellowship 2026 — open to Pakistani students");
    expect(result.fileId).toBeNull();
    expect(result.sourceUrl).toBeNull();
  });
});

/* ─── 2. Text + image — both preserved ───────────────────────────────────── */

describe("text and image in one investigation", () => {
  it("preserves the accompanying text next to the file", () => {
    const result = normalizeInvestigationInput({
      inputType: "image",
      inputFilePath: "user-1/inv-1/screenshot.png",
      inputText: "  A friend forwarded this — is the deadline real?  ",
    });

    expect(result.type).toBe("image");
    // Neither input replaces the other
    expect(result.fileId).toBe("user-1/inv-1/screenshot.png");
    expect(result.content).toBe("A friend forwarded this — is the deadline real?");
    expect(result.metadata.contentLength).toBe(result.content!.length);
  });

  it("an image without text behaves exactly as before", () => {
    const result = normalizeInvestigationInput({
      inputType: "image",
      inputFilePath: "user-1/inv-1/screenshot.png",
    });

    expect(result.content).toBeNull();
    expect(result.fileId).toBe("user-1/inv-1/screenshot.png");
    expect(result.metadata.preview).toContain("screenshot.png");
  });

  it("the file reference is still mandatory when text is supplied", () => {
    expect(() =>
      normalizeInvestigationInput({ inputType: "image", inputText: "some context" }),
    ).toThrow(/requires an inputFilePath/);
  });
});

/* ─── 3. URL + optional question — separate fields, SSRF intact ──────────── */

describe("URL input with an optional question", () => {
  it("keeps the URL as the input and the question as its own field", () => {
    const parsed = createInvestigationSchema.parse({
      inputType: "url",
      inputText: "https://hec.gov.pk/research-fellowship-2026",
      investigationQuestion: "  Can I apply for this, and am I eligible?  ",
    });

    expect(parsed.inputText).toBe("https://hec.gov.pk/research-fellowship-2026");
    expect(parsed.investigationQuestion).toBe("Can I apply for this, and am I eligible?");

    // The investigated content is still only the URL — the question never merges in
    const normalized = normalizeInvestigationInput({
      inputType: "url",
      inputText: parsed.inputText!,
    });
    expect(normalized.sourceUrl).toBe("https://hec.gov.pk/research-fellowship-2026");
    expect(normalized.content).not.toContain("eligible");
  });

  it("an empty or absent question normalizes to undefined", () => {
    expect(
      createInvestigationSchema.parse({
        inputType: "text",
        inputText: "Any scholarship claim",
        investigationQuestion: "   ",
      }).investigationQuestion,
    ).toBeUndefined();

    expect(
      createInvestigationSchema.parse({
        inputType: "text",
        inputText: "Any scholarship claim",
      }).investigationQuestion,
    ).toBeUndefined();
  });

  it("keeps rejecting unsafe URLs even when a question is attached", () => {
    expect(() =>
      createInvestigationSchema.parse({
        inputType: "url",
        inputText: "http://169.254.169.254/latest/meta-data",
        investigationQuestion: "Is this legit?",
      }),
    ).toThrow();
  });
});

/* ─── 4. Image + question (multi-question update spec 20) ────────────────── */

describe("image input with a question", () => {
  it("keeps file, caption and question as three separate fields", () => {
    const parsed = createInvestigationSchema.parse({
      inputType: "image",
      inputFilePath: "user-1/inv-1/poster.png",
      inputText: "Scholarship poster a group admin forwarded",
      investigationQuestion: "Is this outdated and can I apply?",
    });

    expect(parsed.inputFilePath).toBe("user-1/inv-1/poster.png");
    expect(parsed.investigationQuestion).toBe("Is this outdated and can I apply?");

    // What the claims are extracted from is still only the image + its caption.
    const normalized = normalizeInvestigationInput({
      inputType: "image",
      inputFilePath: parsed.inputFilePath,
      inputText: parsed.inputText,
    });
    expect(normalized.fileId).toBe("user-1/inv-1/poster.png");
    expect(normalized.content).toBe("Scholarship poster a group admin forwarded");
    expect(normalized.content).not.toContain("outdated");

    // And the question is classified on its own, deterministically.
    expect(classifyQuestionIntent(parsed.investigationQuestion)).toBe("ELIGIBILITY");
  });

  it("caps a long question to the stored length, and rejects an absurd one", () => {
    const parsed = createInvestigationSchema.parse({
      inputType: "image",
      inputFilePath: "user-1/inv-1/poster.png",
      investigationQuestion: "a".repeat(MAX_QUESTION_LENGTH * 2),
    });
    expect(parsed.investigationQuestion).toHaveLength(MAX_QUESTION_LENGTH);
    // Still inert data: the cap cannot turn a long paste into another intent.
    expect(classifyQuestionIntent(parsed.investigationQuestion)).toBe("GENERAL");

    expect(
      createInvestigationSchema.safeParse({
        inputType: "image",
        inputFilePath: "user-1/inv-1/poster.png",
        investigationQuestion: "a".repeat(MAX_QUESTION_LENGTH * 2 + 1),
      }).success,
    ).toBe(false);
  });

  it("an image with no question behaves exactly as it did before", () => {
    const parsed = createInvestigationSchema.parse({
      inputType: "image",
      inputFilePath: "user-1/inv-1/poster.png",
    });
    expect(parsed.investigationQuestion).toBeUndefined();
    expect(classifyQuestionIntent(parsed.investigationQuestion)).toBe("GENERAL");
  });
});
