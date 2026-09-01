/**
 * Trustlify Backend — Investigation Smoke Test (Phase 4)
 *
 * Runs the REAL evidence-driven investigation executor end-to-end against LIVE
 * providers with an in-memory store (no Supabase persistence):
 *   - exactly ONE Gemini claim-extraction request
 *   - exactly ONE Gemini evidence-analysis request
 *   - AT MOST 3 Tavily search requests
 *   - AT MOST 3 source page fetches
 *   (credit contract, spec 40). No retries, no fallbacks.
 *
 * Usage: npm run smoke:investigation
 *
 * Output is deliberately minimal: stage walk, provider call counts, claims,
 * selected claim, search queries, sources, evidence, verdict + trust score.
 * No full page content, no API keys — keys are read from .env and never printed.
 */

import "dotenv/config";
import { GeminiProvider } from "../ai/GeminiProvider.js";
import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import {
  runInvestigation,
  loadFileFromStorage,
  type ExecutorDeps,
  type ExecutorStore,
  type ExecutorInvestigationRow,
  type ExecutorStagePatch,
  type PersistedClaim,
  type PersistedSource,
  type NewEvidenceRow,
  type ClaimStatusUpdate,
  type DecisionRow,
} from "../investigation/executor.js";
import { fetchWebContent } from "../investigation/webExtractor.js";

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
  const sources: PersistedSource[] = [];
  const evidence: NewEvidenceRow[] = [];
  const claimStatuses: ClaimStatusUpdate[] = [];
  const decisions: DecisionRow[] = [];
  let counter = 0;

  const store: ExecutorStore = {
    async loadInvestigation(id) {
      return row.id === id ? { ...row } : null;
    },
    async updateInvestigation(_id, patch) {
      patches.push({ ...patch });
      if (patch.currentStage) stageUpdates.push(patch.currentStage);
      if (patch.status !== undefined) row.status = patch.status;
    },
    async insertClaims(_investigationId, newClaims) {
      counter += 1;
      return newClaims.map((claim, i) => {
        const persisted: PersistedClaim = {
          id: `smoke-claim-${counter}-${i + 1}`,
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
      counter += 1;
      return newSources.map((source, i) => {
        const persisted: PersistedSource = {
          id: `smoke-source-${counter}-${i + 1}`,
          url: source.url,
          title: source.title,
          domain: source.domain,
          sourceType: source.sourceType,
          snippet: source.snippet,
          retrievedAt: source.retrievedAt,
          createdAt: new Date().toISOString(),
        };
        sources.push(persisted);
        return persisted;
      });
    },
    async insertEvidence(_investigationId, items) {
      counter += 1;
      evidence.push(...items);
      return items.map((_item, i) => ({
        id: `smoke-evidence-${counter}-${i + 1}`,
        createdAt: new Date().toISOString(),
      }));
    },
    async updateClaims(updates) {
      claimStatuses.push(...updates);
    },
    async updateSourceContent() {
      /* content access status is not needed for the smoke summary */
    },
    async insertDecision(_investigationId, decision) {
      decisions.push(decision);
    },
  };

  return { store, stageUpdates, patches, claims, sources, evidence, claimStatuses, decisions };
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  const liveAi = new GeminiProvider();
  const liveSearch = new TavilySearchProvider();

  // Thin counting wrappers — verify the credit contract LIVE.
  let extractCalls = 0;
  let analyzeCalls = 0;
  let searchCalls = 0;
  let fetchCalls = 0;
  const deps: ExecutorDeps = {
    ai: {
      extractClaims: async (input) => {
        extractCalls += 1;
        return liveAi.extractClaims(input);
      },
      analyzeEvidence: async (input) => {
        analyzeCalls += 1;
        return liveAi.analyzeEvidence(input);
      },
    },
    search: {
      search: async (input) => {
        searchCalls += 1;
        return liveSearch.search(input);
      },
    },
    fetchContent: async (url) => {
      fetchCalls += 1;
      return fetchWebContent(url);
    },
    loadFile: loadFileFromStorage,
  };

  const memory = createMemoryStore();
  const startedAt = Date.now();

  console.log("─── Trustlify Investigation Smoke Test ───");
  console.log(`Model: ${liveAi.model}`);
  console.log(
    "Providers: Gemini (2 requests max) + Tavily (3 requests max) + page fetches (3 max)",
  );
  console.log(`Input: "${SMOKE_INPUT}"`);
  console.log("");

  const result = await runInvestigation("smoke-investigation", deps, memory.store);
  const { stageUpdates, patches, claims, sources, evidence, claimStatuses, decisions } = memory;
  const durationMs = Date.now() - startedAt;

  console.log(`Finished in ${durationMs}ms`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Final stage:  ${result.finalStage}`);
  console.log(`Stage walk:   ${stageUpdates.join(" → ") || "(no stage transitions)"}`);
  console.log(
    `Provider calls: Gemini extract=${extractCalls}, Gemini analyze=${analyzeCalls}, Tavily=${searchCalls}, fetches=${fetchCalls}`,
  );
  console.log("");

  console.log(`Claims extracted (${claims.length}):`);
  for (const claim of claims) {
    const status = claimStatuses.find((s) => s.claimId === claim.id)?.status ?? "pending";
    console.log(`  - [${claim.type}/${claim.importance} → ${status}] ${claim.text}`);
  }
  console.log("");

  const selectedClaimId =
    patches.find((p) => p.selectedClaimId !== undefined)?.selectedClaimId ?? null;
  const selected = claims.find((c) => c.id === selectedClaimId) ?? null;
  console.log("Selected claim (deterministic — never a second AI call):");
  console.log(
    selected
      ? `  - [${selected.type}/${selected.importance}] ${selected.text}`
      : "  - (none)",
  );
  console.log("");

  const searchQueries = result.searchQueries;
  console.log(`Search queries (${searchQueries.length}):`);
  for (const query of searchQueries) {
    console.log(`  - ${query}`);
  }
  console.log(`Sources discovered: ${sources.length}`);
  for (const source of sources.slice(0, 6)) {
    console.log(`  - ${source.domain} [${source.sourceType}] — ${source.title}`);
  }
  if (sources.length > 6) console.log(`  - … ${sources.length - 6} more`);
  console.log("");

  console.log(`Evidence verified: ${evidence.length}`);
  for (const item of evidence.slice(0, 4)) {
    console.log(
      `  - ${item.relation} (${item.confidence}/${item.verificationStatus}) claim=${item.claimId} source=${item.sourceId}`,
    );
  }
  if (evidence.length > 4) console.log(`  - … ${evidence.length - 4} more`);
  console.log("");

  const decision = decisions[0];
  if (decision) {
    console.log(`Verdict:      ${decision.verdict}`);
    console.log(`Trust score:  ${decision.trustScore}/100`);
    console.log(`Action:       ${decision.recommendedAction}`);
    console.log("Reasons:");
    for (const reason of decision.reasons) {
      console.log(`  • ${reason}`);
    }
  } else {
    console.log("Verdict: (no decision was persisted)");
  }
  console.log("");

  if (result.finalStatus === "failed") {
    console.error(`INVESTIGATION FAILED: ${result.errorMessage}`);
    return 1;
  }

  if (extractCalls > 1 || analyzeCalls > 1 || searchCalls > 3 || fetchCalls > 4) {
    console.error(
      "CREDIT CONTRACT VIOLATED — too many provider calls were made.",
    );
    return 1;
  }

  console.log(
    "SMOKE TEST PASSED — honest stage walk, credit contract respected, deterministic verdict.",
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
