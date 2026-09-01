/**
 * Trustlify Backend — Investigation Validators
 */

import { z } from "zod";
import { urlInputSchema } from "../utils/urls.js";

/**
 * The optional question is UNTRUSTED user context, kept strictly separate from
 * inputText (the material claims are extracted from). It is never sent to the
 * model as an instruction — only length-capped, trimmed and pattern-matched by
 * the deterministic intent classifier. An empty string means "no question".
 */
export const MAX_QUESTION_LENGTH = 500;

export const createInvestigationSchema = z
  .object({
    inputType: z.enum(["url", "text", "image", "pdf"]),
    inputText: z.string().min(1).max(10000).optional(),
    inputFilePath: z.string().max(500).optional(),
    investigationQuestion: z
      .string()
      .max(MAX_QUESTION_LENGTH * 2)
      .optional()
      .transform((value) => {
        const trimmed = (value ?? "").trim();
        return trimmed ? trimmed.slice(0, MAX_QUESTION_LENGTH) : undefined;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.inputType === "url") {
      if (!data.inputText) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "inputText (URL) is required when inputType is 'url'",
          path: ["inputText"],
        });
      } else {
        const result = urlInputSchema.safeParse(data.inputText);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.error.issues[0]?.message ?? "Invalid URL",
            path: ["inputText"],
          });
        }
      }
    }
    if (data.inputType === "text" && !data.inputText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "inputText is required when inputType is 'text'",
        path: ["inputText"],
      });
    }
    if (
      (data.inputType === "image" || data.inputType === "pdf") &&
      !data.inputFilePath
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `inputFilePath is required when inputType is '${data.inputType}'`,
        path: ["inputFilePath"],
      });
    }
  });

export type CreateInvestigationInput = z.infer<typeof createInvestigationSchema>;
