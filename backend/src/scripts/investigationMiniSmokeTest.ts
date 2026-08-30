/**
 * Trustlify Backend — Mini Investigation Smoke Test (Phase 3C)
 *
 * Runs the REAL mini-investigation executor end-to-end against LIVE providers:
 * exactly ONE Gemini claim-extraction request and ONE Tavily search request
 * (credit contract, spec 23). No retries, no fallbacks, no Supabase
 * persistence — the executor runs against an in-memory store.
 *
 * Usage: npm run smoke:investigation
 *
 * Output (spec 27) is deliberately minimal: extracted claims, selected claim,
 * search query, result count, source titles/domains, final investigation
 * stage. No full page content, no API keys — keys are read from .env and
 * never printed.
 */

import "dotenv/config";
import { GeminiProvider } from "../ai/GeminiProvider.js";
import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import {
  runMiniInvestigation,
  type ExecutorDeps,
  type ExecutorStore,
  type ExecutorInvestigationRow,
  type ExecutorStagePatch,
  type PersistedClaim,
} from "../investigation/executor.js";
import type { NormalizedSource } from "../investigation/sourceNormalizer.js";

const SMOKE_INPUT =
  "The XYZ scholarship is fully funded and applications close on September 15, 2026.";

/* ─── In-memory executor store — records every write, persists nothing ─────── */

function createMemoryStore() {
  const row: ExecutorInvestigationRow = {
    id: "smoke-investigation",
    inputType: "text",
    inputText: SMOKE_INPUT,
    inputFilePath: null,
    status: "processing",
    currentStage: "NORMALIZING",
  };

  const stageUpdates: string[] = [];
  const patches: ExecutorStagePatch[] = [];
  const claims: PersistedClaim[] = [];
  const sources: NormalizedSource[] = [];

  const store: ExecutorStore = {
    async loadInvestigation(id) {
      return row.id === id ? { ...row } : null;
    },
    async updateInvestigation(_id, patch) {
      patches.push({ ...patch });
      if (patch.currentStage) stageUpdates.push(patch.currentStage);
    },
    async insertClaims(_investigationId, newClaims) {
      return newClaims.map((claim, i) => {
        const persisted: PersistedClaim = {
          id: `smoke-claim-${i + 1}`,
          text: claim.text,
          type: claim.type,
          importance: claim.importance,
          createdAt: new Date().toISOString(),
        };
        claims.push(persisted);
        return persisted;
      });
    },
    async insertSources(_investigationId, newSources) {
      return newSources.map((source, i) => {
        sources.push(source);
        return { id: `smoke-source-${i + 1}`, createdAt: source.retrievedAt };
      });
    },
  };

  return { store, stageUpdates, patches, claims, sources };
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  const liveAi = new GeminiProvider();
  const liveSearch = new TavilySearchProvider();

  // Thin counting wrappers — verify the credit contract LIVE: exactly one
  // call per provider, even in failure paths.
  let aiCalls = 0;
  let searchCalls = 0;
  const deps: ExecutorDeps = {
    ai: {
      extractClaims: async (input) => {
        aiCalls += 1;
        return liveAi.extractClaims(input);
      },
    },
    search: {
      search: async (input) => {
        searchCalls += 1;
        return liveSearch.search(input);
      },
    },
  };

  const memory = createMemoryStore();
  const startedAt = Date.now();

  console.log("─── Trustlify Mini Investigation Smoke Test ───");
  console.log(`Model: ${liveAi.model}`);
  console.log("Providers: Gemini (1 request max) + Tavily (1 request max)");
  console.log(`Input: "${SMOKE_INPUT}"`);
  console.log("");

  const result = await runMiniInvestigation("smoke-investigation", deps, memory.store);
  const { stageUpdates, patches, claims, sources } = memory;
  const durationMs = Date.now() - startedAt;

  console.log(`Finished in ${durationMs}ms`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Final stage:  ${result.finalStage}`);
  console.log(`Stage walk:   ${stageUpdates.join(" → ") || "(no stage transitions)"}`);
  console.log(`Provider calls: Gemini=${aiCalls}, Tavily=${searchCalls}`);
  console.log("");

  console.log(`Claims extracted (${claims.length}):`);
  for (const claim of claims) {
    console.log(`  - [${claim.type}/${claim.importance}] ${claim.text}`);
  }
  console.log("");

  const selectedClaimId =
    patches.find((p) => p.selectedClaimId !== undefined)?.selectedClaimId ?? null;
  const selected = claims.find((c) => c.id === selectedClaimId) ?? null;
  console.log("Selected claim (deterministic — no second AI call):");
  console.log(
    selected
      ? `  - [${selected.type}/${selected.importance}] ${selected.text}`
      : "  - (none)",
  );
  console.log("");

  const searchQuery = patches.find((p) => p.searchQuery !== undefined)?.searchQuery ?? null;
  console.log(`Search query: ${searchQuery ?? "(none)"}`);
  console.log(`Search results: ${sources.length}`);
  for (const source of sources) {
    console.log(`  - ${source.domain} [${source.sourceType}] — ${source.title}`);
  }
  console.log("");

  if (result.finalStatus === "failed") {
    console.error(`INVESTIGATION FAILED: ${result.errorMessage}`);
    return 1;
  }

  if (aiCalls > 1 || searchCalls > 1) {
    console.error(
      "CREDIT CONTRACT VIOLATED — more than one provider call was made.",
    );
    return 1;
  }

  console.log(
    "SMOKE TEST PASSED — one Gemini call, one Tavily call, honest stage walk.",
  );
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
