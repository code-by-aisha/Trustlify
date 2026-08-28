/**
 * Trustlify Backend — Investigation Validators
 */

import { z } from "zod";
import { urlInputSchema } from "../utils/urls.js";

export const createInvestigationSchema = z
  .object({
    inputType: z.enum(["url", "text", "image", "pdf"]),
    inputText: z.string().min(1).max(10000).optional(),
    inputFilePath: z.string().max(500).optional(),
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
