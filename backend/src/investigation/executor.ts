/**
 * Trustlify Backend — Mini Investigation Executor
 *
 * Phase 3C: runs the real mini-investigation state machine:
 *
 *   NORMALIZING → CLAIMS → SEARCH → SOURCES → COMPLETE
 *
 * Credit contract (STRICT, spec 23): exactly ONE Gemini claim-extraction
 * request and ONE Tavily search request per investigation. No retries, no
 * fallback models, no additional searches. A failure at any stage fails the
 * investigation honestly — later stages are never attempted after a failure.
 *
 * Product principle (spec 02): Trustlify is NOT a chatbot. The executor
 * produces an evidence-ready structure (claims + sources) and stops. No
 * verdict, no trust score, no evidence relationships — those belong to the
 * future Trust Engine. Every claim's verification status stays 'pending'.
 *
 * URL inputs: Phase 3C performs NO server-side fetch of the submitted URL —
 * claims are extracted from the URL string itself, honestly and without
 * invention. Full URL content extraction arrives with the ContentExtractor
 * phase (spec 24: InputNormalizer → InputType → ContentExtractor → Claims).
 *
 * ⚠ UNTRUSTED CONTENT BOUNDARY (spec 12): claim text returned by Gemini and
 * titles/snippets/URLs returned by Tavily enter this pipeline as inert string
 * data. They are stored, never evaluated, and result URLs are never fetched.
 */

import { supabaseAdmin } from "../config/supabase.js";
import { logger } from "../utils/logger.js";
import { GeminiProvider } from "../ai/GeminiProvider.js";
import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import { AIError } from "../ai/errors.js";
import { SearchError } from "../search/errors.js";
import type { AIProvider } from "../ai/AIProvider.js";
import type { SearchProvider } from "../search/SearchProvider.js";
import {
  normalizeInvestigationInput,
  InputValidationError,
} from "./inputNormalizer.js";
import { selectPriorityClaim, buildSearchQuery } from "./claimSelector.js";
import { normalizeSearchSources } from "./sourceNormalizer.js";
import type { NormalizedSource } from "./sourceNormalizer.js";

/* ─── Stage model (spec 13) ───────────────────────────────────────────────── */

export const MINI_INVESTIGATION_STAGES = [
  "NORMALIZING",
  "CLAIMS",
  "SEARCH",
  "SOURCES",
  "COMPLETE",
] as const;

export type MiniInvestigationStage = (typeof MINI_INVESTIGATION_STAGES)[number];

/* ─── Limits ──────────────────────────────────────────────────────────────── */

/** Defensive bound on persisted claims per investigation. */
const MAX_CLAIMS = 20;
/** Spec 09: maximum 5 returned search results. */
const SEARCH_MAX_RESULTS = 5;

/* ─── Injectable dependencies (tests pass fakes — never live providers) ───── */

export interface ExecutorDeps {
  ai: Pick<AIProvider, "extractClaims">;
  search: Pick<SearchProvider, "search">;
}

/* ─── Persistence seam ────────────────────────────────────────────────────── */

export interface ExecutorInvestigationRow {
  id: string;
  inputType: "url" | "text" | "image" | "pdf";
  inputText: string | null;
  inputFilePath: string | null;
  status: string;
  currentStage: string | null;
}

export interface NewClaimRow {
  text: string;
  type: string;
  importance: string;
}

export interface PersistedClaim {
  id: string;
  text: string;
  type: string;
  importance: string;
  createdAt: string;
}

export interface PersistedSource {
  id: string;
  createdAt: string;
}

export interface ExecutorStagePatch {
  status?: "processing" | "complete" | "failed";
  currentStage?: string;
  searchQuery?: string;
  selectedClaimId?: string | null;
  errorMessage?: string | null;
}

/**
 * Persistence seam for the executor. The Supabase-backed implementation is
 * the production path; tests inject an in-memory fake so automated tests
 * never touch Supabase, Gemini, or Tavily (spec 26).
 */
export interface ExecutorStore {
  loadInvestigation(id: string): Promise<ExecutorInvestigationRow | null>;
  updateInvestigation(id: string, patch: ExecutorStagePatch): Promise<void>;
  insertClaims(
    investigationId: string,
    claims: NewClaimRow[],
  ): Promise<PersistedClaim[]>;
  insertSources(
    investigationId: string,
    sources: NormalizedSource[],
  ): Promise<PersistedSource[]>;
}

export function createSupabaseExecutorStore(): ExecutorStore {
  return {
    async loadInvestigation(id) {
      const { data, error } = await supabaseAdmin
        .from("investigations")
        .select("id, input_type, input_text, input_file_path, status, current_stage")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }
      return {
        id: data.id,
        inputType: data.input_type,
        inputText: data.input_text,
        inputFilePath: data.input_file_path,
        status: data.status,
        currentStage: data.current_stage,
      };
    },

    async updateInvestigation(id, patch) {
      const update: Record<string, unknown> = {};
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.currentStage !== undefined) update.current_stage = patch.currentStage;
      if (patch.searchQuery !== undefined) update.search_query = patch.searchQuery;
      if (patch.selectedClaimId !== undefined) {
        update.selected_claim_id = patch.selectedClaimId;
      }
      if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;

      const { error } = await supabaseAdmin
        .from("investigations")
        .update(update)
        .eq("id", id);

      if (error) {
        throw new Error(`investigation update failed: ${error.message}`);
      }
    },

    async insertClaims(investigationId, claims) {
      if (claims.length === 0) return [];

      const rows = claims.map((claim) => ({
        investigation_id: investigationId,
        claim_text: claim.text,
        claim_type: claim.type,
        importance: claim.importance,
        verification_status: "pending",
      }));

      const { data, error } = await supabaseAdmin
        .from("claims")
        .insert(rows)
        .select("id, claim_text, claim_type, importance, created_at");

      if (error) {
        throw new Error(`claims insert failed: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        text: row.claim_text,
        type: row.claim_type,
        importance: row.importance,
        createdAt: row.created_at,
      }));
    },

    async insertSources(investigationId, sources) {
      if (sources.length === 0) return [];

      const rows = sources.map((source) => ({
        investigation_id: investigationId,
        url: source.url,
        title: source.title,
        domain: source.domain,
        source_type: source.sourceType,
        snippet: source.snippet,
        retrieved_at: source.retrievedAt,
        // publisher/published_at are deliberately null — never invented (spec 10)
      }));

      const { data, error } = await supabaseAdmin
        .from("sources")
        .insert(rows)
        .select("id, created_at");

      if (error) {
        throw new Error(`sources insert failed: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
      }));
    },
  };
}

/* ─── Safe failure messages (spec 22) ─────────────────────────────────────── */

/**
 * Map any executor failure to a safe, user-facing message.
 * Never includes API keys, internal details, SQL, or stack traces — those go
 * to the server log only.
 */
export function safeFailureMessage(error: unknown): string {
  if (error instanceof InputValidationError) {
    return error.message;
  }
  if (error instanceof AIError) {
    return "Claim extraction failed — the AI service could not complete this investigation. Please try again later.";
  }
  if (error instanceof SearchError) {
    return "Web search failed — the search service could not complete this investigation. Please try again later.";
  }
  return "Investigation failed — please try again later.";
}

function errorCodeOf(error: unknown): string | undefined {
  if (error instanceof AIError || error instanceof SearchError) {
    return error.code;
  }
  return undefined;
}

/* ─── Executor ────────────────────────────────────────────────────────────── */

export interface MiniInvestigationResult {
  investigationId: string;
  finalStatus: "complete" | "failed";
  finalStage: string;
  claimCount: number;
  sourceCount: number;
  searchQuery: string | null;
  errorMessage: string | null;
}

/**
 * Run the mini investigation to completion (or honest failure).
 *
 * Every stage transition is persisted so polling clients observe real state.
 * The function never throws — failures are captured, logged, and persisted.
 */
export async function runMiniInvestigation(
  investigationId: string,
  deps: ExecutorDeps,
  store: ExecutorStore,
): Promise<MiniInvestigationResult> {
  let stage: string = "NORMALIZING";
  let searchQuery: string | null = null;
  let claimCount = 0;
  let sourceCount = 0;

  const fail = async (error: unknown): Promise<MiniInvestigationResult> => {
    const message = safeFailureMessage(error);
    logger.error("Mini investigation failed", {
      investigationId,
      stage,
      code: errorCodeOf(error),
      // Provider messages are already scrubbed of secrets by the providers.
      detail:
        error instanceof AIError || error instanceof SearchError
          ? error.message
          : undefined,
    });

    try {
      await store.updateInvestigation(investigationId, {
        status: "failed",
        errorMessage: message,
      });
    } catch (persistError) {
      logger.error("Failed to persist investigation failure state", {
        investigationId,
        error:
          persistError instanceof Error ? persistError.message : String(persistError),
      });
    }

    return {
      investigationId,
      finalStatus: "failed",
      finalStage: stage,
      claimCount,
      sourceCount,
      searchQuery,
      errorMessage: message,
    };
  };

  try {
    const investigation = await store.loadInvestigation(investigationId);
    if (!investigation) {
      return await fail(new Error("Investigation row not found"));
    }

    /* ── Stage: NORMALIZING (set by the start endpoint before this runs) ── */
    const normalized = normalizeInvestigationInput({
      inputType: investigation.inputType,
      inputText: investigation.inputText ?? undefined,
      inputFilePath: investigation.inputFilePath ?? undefined,
    });

    if (normalized.type === "image" || normalized.type === "pdf") {
      // Honest interface boundary (spec 03/24): file content extraction
      // arrives in a later phase — never pretend to investigate what cannot
      // be read yet.
      return await fail(
        new InputValidationError(
          "Image and PDF investigations are not available yet — they arrive in a later phase",
        ),
      );
    }

    const content = normalized.content;
    if (!content) {
      return await fail(
        new InputValidationError("Input content is empty after normalization"),
      );
    }

    /* ── Stage: CLAIMS — exactly ONE Gemini request (spec 06) ── */
    stage = "CLAIMS";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const extraction = await deps.ai.extractClaims({
      text: content,
      inputType: normalized.type,
    });

    const extracted = extraction.claims.slice(0, MAX_CLAIMS);
    if (extracted.length === 0) {
      return await fail(
        new InputValidationError("No claims could be extracted from this input"),
      );
    }

    const persistedClaims = await store.insertClaims(investigationId, extracted);
    claimCount = persistedClaims.length;

    // Deterministic selection — never a second AI call (spec 07).
    const selected = selectPriorityClaim(extracted);
    if (!selected) {
      return await fail(
        new InputValidationError("No claims could be extracted from this input"),
      );
    }

    // Match the selected extracted claim back to its persisted row. Matching
    // by (text, type, importance) is robust to row ordering; duplicate matches
    // are semantically identical claims, so the first is correct.
    const selectedRow =
      persistedClaims.find(
        (row) =>
          row.text === selected.text &&
          row.type === selected.type &&
          row.importance === selected.importance,
      ) ?? null;

    /* ── Stage: SEARCH — ONE deterministic query, ONE Tavily request ── */
    stage = "SEARCH";
    searchQuery = buildSearchQuery(selected);
    await store.updateInvestigation(investigationId, {
      currentStage: stage,
      searchQuery,
      ...(selectedRow ? { selectedClaimId: selectedRow.id } : {}),
    });

    const searchOutput = await deps.search.search({
      query: searchQuery,
      maxResults: SEARCH_MAX_RESULTS,
    });

    // ⚠ Search results are UNTRUSTED DATA from here on (spec 12): normalized
    // into inert strings, stored, never evaluated, never fetched.
    const normalizedSources = normalizeSearchSources(searchOutput.results);

    /* ── Stage: SOURCES — persist normalized sources ── */
    stage = "SOURCES";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const persistedSources = await store.insertSources(
      investigationId,
      normalizedSources,
    );
    sourceCount = persistedSources.length;

    /* ── Stage: COMPLETE — an empty search result set is a valid outcome ── */
    stage = "COMPLETE";
    await store.updateInvestigation(investigationId, {
      status: "complete",
      currentStage: stage,
    });

    logger.info("Mini investigation completed", {
      investigationId,
      claimCount,
      sourceCount,
    });

    return {
      investigationId,
      finalStatus: "complete",
      finalStage: "COMPLETE",
      claimCount,
      sourceCount,
      searchQuery,
      errorMessage: null,
    };
  } catch (error) {
    return await fail(error);
  }
}

/* ─── Background entry point ──────────────────────────────────────────────── */

/**
 * Launch the mini investigation in the background (fire-and-forget) from the
 * start endpoint. In-process async execution — no queues, no Redis (spec 15).
 * If the process restarts mid-run, the row remains 'processing'; recovery of
 * in-flight jobs is deliberately out of scope for this phase.
 */
export function runInvestigationInBackground(investigationId: string): void {
  const deps: ExecutorDeps = {
    ai: new GeminiProvider(),
    search: new TavilySearchProvider(),
  };

  void runMiniInvestigation(
    investigationId,
    deps,
    createSupabaseExecutorStore(),
  ).catch((error) => {
    // Last-resort guard: runMiniInvestigation captures its own failures.
    logger.error("Mini investigation executor crashed", {
      investigationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
