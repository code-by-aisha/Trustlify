/**
 * Trustlify Backend — Gemini Smoke Test (Phase 3A)
 *
 * Makes exactly ONE live Gemini API request to verify connectivity and
 * structured JSON output. No retries, no fallbacks.
 *
 * Usage: npm run smoke:gemini
 *
 * The API key is read from GEMINI_API_KEY and never printed.
 */

import "dotenv/config";
import { GeminiProvider } from "../ai/GeminiProvider.js";
import { AIError } from "../ai/errors.js";

const SMOKE_INPUT = {
  text: "The XYZ scholarship is fully funded and applications close on September 15, 2026.",
  inputType: "text" as const,
};

const EXPECTED_CLAIM_SUBSTRINGS = ["fully funded", "September 15, 2026"];

async function main(): Promise<number> {
  const provider = new GeminiProvider();
  const startedAt = Date.now();

  console.log("─── Trustlify Gemini Smoke Test ───");
  console.log(`Model: ${provider.model}`);
  console.log(`Input: "${SMOKE_INPUT.text}"`);
  console.log("");

  let claims;
  try {
    const output = await provider.extractClaims(SMOKE_INPUT);
    claims = output.claims;
  } catch (err) {
    if (err instanceof AIError) {
      console.error(`LIVE REQUEST FAILED  [${err.code}]`);
      console.error(`Message: ${err.message}`);
      if (err.httpStatus) {
        console.error(`HTTP status: ${err.httpStatus}`);
      }
    } else {
      console.error("LIVE REQUEST FAILED  [UNKNOWN]");
      console.error(`Message: ${(err as Error).message}`);
    }
    return 1;
  }

  const durationMs = Date.now() - startedAt;

  console.log(`LIVE REQUEST SUCCEEDED in ${durationMs}ms`);
  console.log("");
  console.log("Structured JSON validation: PASSED (Zod)");
  console.log(`Claims extracted (${claims.length}):`);
  for (const claim of claims) {
    console.log(`  - [${claim.type}/${claim.importance}] ${claim.text}`);
  }
  console.log("");

  const missing = EXPECTED_CLAIM_SUBSTRINGS.filter(
    (needle) =>
      !claims.some((claim) => claim.text.toLowerCase().includes(needle.toLowerCase())),
  );

  if (missing.length > 0) {
    console.warn(
      `NOTE: expected claim(s) not found in output: ${missing.map((m) => `"${m}"`).join(", ")}`,
    );
  } else {
    console.log("Expected claims found: both factual claims present.");
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Smoke test crashed:", (err as Error).message);
    process.exitCode = 1;
  });
