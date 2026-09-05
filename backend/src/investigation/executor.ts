/**
 * Trustlify Backend — Investigation Executor
 *
 * Phase 4: runs the REAL end-to-end investigation state machine (spec 02/32):
 *
 *   NORMALIZING → EXTRACTING_CONTENT → EXTRACTING_CLAIMS → SEARCHING →
 *   READING_SOURCES → ANALYZING_EVIDENCE → CALCULATING_TRUST → COMPLETE
 *
 * Credit contract (STRICT, spec 40):
 *   - exactly ONE Gemini claim-extraction request
 *   - exactly ONE Gemini evidence-analysis request
 *   - AT MOST 3 Tavily search requests (fewer when a strong official source
 *     is already found — spec 15)
 *   - AT MOST 3 selected source page fetches
 *   - NO automatic retries, NO fallback models, NO recursive agents
 *
 * Product principle (spec 01): Gemini understands content, extracts claims,
 * and analyzes supplied evidence. Tavily discovers sources. The deterministic
 * Trust Engine decides the verdict. The LLM NEVER decides the verdict.
 *
 * Failure honesty (spec 33): a submitted-URL fetch failure fails the
 * investigation (there is no content to investigate); a search with no useful
 * results continues honestly and can end UNVERIFIED; a source-fetch failure
 * keeps the source metadata and marks its content unavailable; an
 * evidence-analysis failure invents nothing AND does not masquerade as a
 * verdict — it fails the investigation with its own cause.
 *
 * Every content failure is additionally classified into an explicit
 * `ContentFailureCode` (INVALID_URL / FETCH_FAILED / ACCESS_BLOCKED /
 * EXTRACTION_FAILED / EMPTY_CONTENT / UNSUPPORTED_CONTENT) whose user-facing
 * message says what happened, why, and what to do next — a student never sees a
 * vague pipeline error when a specific reason exists. A redirect is not one of
 * those failures (see webExtractor's REDIRECTED outcome).
 *
 * ⚠ UNTRUSTED CONTENT BOUNDARY (spec 12/22): claim text, titles, snippets,
 * and fetched page content enter this pipeline as inert string data. They are
 * stored and passed to Gemini fenced as evidence — never evaluated, never
 * executed, never allowed to alter pipeline behavior.
 */

import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { GeminiProvider } from "../ai/GeminiProvider.js";
import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import { AIError } from "../ai/errors.js";
import type { AIErrorCode } from "../ai/errors.js";
import { SearchError } from "../search/errors.js";
import type { AIProvider, AnalyzeEvidenceOutput } from "../ai/AIProvider.js";
import type { SearchProvider } from "../search/SearchProvider.js";
import {
  normalizeInvestigationInput,
  InputValidationError,
  type NormalizedInput,
} from "./inputNormalizer.js";
import { rankClaims } from "./claimSelector.js";
import { planSearchQueries, SEARCH_MAX_RESULTS } from "./searchPlanner.js";
import {
  normalizeSearchSources,
  dedupeSources,
  selectSourcesForFetch,
  canonicalUrlKey,
  type NormalizedSource,
} from "./sourceNormalizer.js";
import {
  fetchWebContent,
  WebFetchError,
  contentFailureFromFetchError,
  contentOutcomeOf,
  describeContentFailure,
  isContentFailureCode,
  type ContentFailure,
  type ContentFailureCode,
  type FetchedWebContent,
} from "./webExtractor.js";
import {
  validateEvidenceAnalysis,
  deriveClaimStatuses,
  type InvestigatorClaim,
  type InvestigatorSource,
  type VerifiedEvidence,
} from "./investigator.js";
import { assessInvestigationCurrentness } from "../engines/currentnessEngine.js";
import { detectRiskSignals } from "../engines/riskEngine.js";
import {
  calculateTrustDecision,
  isAuthoritativeSource,
  type Verdict,
} from "../engines/trustEngine.js";
import type { ClaimType, ClaimImportance } from "../types/investigation.js";

/* ─── Stage model (spec 32) ───────────────────────────────────────────────── */

export const INVESTIGATION_STAGES = [
  "NORMALIZING",
  "EXTRACTING_CONTENT",
  "EXTRACTING_CLAIMS",
  "SEARCHING",
  "READING_SOURCES",
  "ANALYZING_EVIDENCE",
  "CALCULATING_TRUST",
  "COMPLETE",
] as const;

export type InvestigationStage = (typeof INVESTIGATION_STAGES)[number];

/* ─── Limits ──────────────────────────────────────────────────────────────── */

/** Defensive bound on persisted claims per investigation. */
const MAX_CLAIMS = 20;
/** Claims sent to the single evidence-analysis request (highest ranked). */
const MAX_ANALYSIS_CLAIMS = 8;

/* ─── Injectable dependencies (tests pass fakes — never live providers) ───── */

export interface ExecutorDeps {
  ai: Pick<AIProvider, "extractClaims" | "analyzeEvidence">;
  search: Pick<SearchProvider, "search">;
  /** Fetches page content safely (SSRF-validated) — injected for tests. */
  fetchContent: (url: string) => Promise<FetchedWebContent>;
  /** Reads an uploaded file from storage as base64 (image/PDF inputs). */
  loadFile: (filePath: string) => Promise<{ base64: string; mimeType: string }>;
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
  type: ClaimType;
  importance: ClaimImportance;
}

export interface PersistedClaim {
  id: string;
  text: string;
  type: ClaimType;
  importance: ClaimImportance;
  createdAt: string;
}

export interface PersistedSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  sourceType: string;
  snippet: string;
  retrievedAt: string;
  createdAt: string;
}

export interface NewEvidenceRow {
  claimId: string;
  sourceId: string;
  relation: string;
  excerpt: string;
  reason: string;
  confidence: string;
  verificationStatus: string;
}

export interface PersistedEvidence {
  id: string;
  createdAt: string;
}

export interface ClaimStatusUpdate {
  claimId: string;
  status: string;
  reasoningSummary: string;
}

export interface ExecutorStagePatch {
  status?: "processing" | "complete" | "failed";
  currentStage?: string;
  searchQuery?: string;
  selectedClaimId?: string | null;
  errorMessage?: string | null;
  originalUrl?: string | null;
  finalUrl?: string | null;
  originalDomain?: string | null;
  finalDomain?: string | null;
  domainChanged?: boolean;
  contentTruncated?: boolean;
  verdict?: string | null;
  trustScore?: number | null;
}

export interface DecisionRow {
  verdict: string;
  trustScore: number;
  explanation: string;
  recommendedAction: string;
  reasons: string[];
}

/**
 * Persistence seam for the executor. The Supabase-backed implementation is
 * the production path; tests inject an in-memory fake so automated tests
 * never touch Supabase, Gemini, or Tavily (spec 42).
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
  insertEvidence(
    investigationId: string,
    evidence: NewEvidenceRow[],
  ): Promise<PersistedEvidence[]>;
  updateClaims(updates: ClaimStatusUpdate[]): Promise<void>;
  updateSourceContent(
    sourceId: string,
    patch: { accessStatus: string; publishedAt?: string | null },
  ): Promise<void>;
  insertDecision(investigationId: string, decision: DecisionRow): Promise<void>;
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
      if (patch.originalUrl !== undefined) update.original_url = patch.originalUrl;
      if (patch.finalUrl !== undefined) update.final_url = patch.finalUrl;
      if (patch.originalDomain !== undefined) update.original_domain = patch.originalDomain;
      if (patch.finalDomain !== undefined) update.final_domain = patch.finalDomain;
      if (patch.domainChanged !== undefined) update.domain_changed = patch.domainChanged;
      if (patch.contentTruncated !== undefined) update.content_truncated = patch.contentTruncated;
      if (patch.verdict !== undefined) update.verdict = patch.verdict;
      if (patch.trustScore !== undefined) update.trust_score = patch.trustScore;

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
        // Values were validated by the AI response schema at insert time and
        // are enforced by the database check constraints.
        type: row.claim_type as ClaimType,
        importance: row.importance as ClaimImportance,
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
        // publisher/published_at are deliberately null — never invented (spec 16)
      }));

      const { data, error } = await supabaseAdmin
        .from("sources")
        .insert(rows)
        .select("id, url, title, domain, source_type, snippet, retrieved_at, created_at");

      if (error) {
        throw new Error(`sources insert failed: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        url: row.url,
        title: row.title ?? "",
        domain: row.domain ?? "",
        sourceType: row.source_type,
        snippet: row.snippet ?? "",
        retrievedAt: row.retrieved_at,
        createdAt: row.created_at,
      }));
    },

    async insertEvidence(_investigationId, evidence) {
      if (evidence.length === 0) return [];

      const rows = evidence.map((item) => ({
        claim_id: item.claimId,
        source_id: item.sourceId,
        excerpt: item.excerpt,
        relation: item.relation,
        reason: item.reason,
        confidence: item.confidence,
        verification_status: item.verificationStatus,
      }));

      const { data, error } = await supabaseAdmin
        .from("evidence")
        .insert(rows)
        .select("id, created_at");

      if (error) {
        throw new Error(`evidence insert failed: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
      }));
    },

    async updateClaims(updates) {
      for (const update of updates) {
        const { error } = await supabaseAdmin
          .from("claims")
          .update({
            verification_status: update.status,
            reasoning_summary: update.reasoningSummary,
          })
          .eq("id", update.claimId);

        if (error) {
          throw new Error(`claim status update failed: ${error.message}`);
        }
      }
    },

    async updateSourceContent(sourceId, patch) {
      const update: Record<string, unknown> = { access_status: patch.accessStatus };
      if (patch.publishedAt !== undefined) update.published_at = patch.publishedAt;

      const { error } = await supabaseAdmin
        .from("sources")
        .update(update)
        .eq("id", sourceId);

      if (error) {
        throw new Error(`source update failed: ${error.message}`);
      }
    },

    async insertDecision(investigationId, decision) {
      const { error } = await supabaseAdmin.from("decisions").insert({
        investigation_id: investigationId,
        verdict: decision.verdict,
        trust_score: decision.trustScore,
        explanation: decision.explanation,
        recommended_action: [decision.recommendedAction],
        reasons: decision.reasons,
      });

      if (error) {
        throw new Error(`decision insert failed: ${error.message}`);
      }
    },
  };
}

/* ─── Safe failure messages (spec 33) ─────────────────────────────────────── */

/**
 * The structured content failure behind an error, when there is one. Content
 * failures are the only investigation failures a student can act on, so they
 * are classified by CATEGORY rather than by prose.
 */
function contentFailureFrom(error: unknown): ContentFailure | null {
  return error instanceof WebFetchError ? contentFailureFromFetchError(error) : null;
}

/**
 * The evidence-analysis stage failed while the content was already in hand.
 * This must never be phrased as a judgement about the investigated website:
 * Trustlify read the page successfully — its own analysis did not finish.
 */
export const EVIDENCE_ANALYSIS_FAILURE_MESSAGE =
  "The sources were fetched successfully, but Trustlify could not complete the evidence analysis — this is a Trustlify service issue, not a finding about this website. Please run the investigation again in a few minutes.";

/**
 * Map any executor failure to a safe, user-facing message.
 * Never includes API keys, internal details, SQL, or stack traces — those go
 * to the server log only. A page that could not be read is reported by its
 * specific category (what happened + why + what to do next) instead of one
 * generic "could not be fetched" line.
 *
 * `stage` matters for AI errors only: the stage is what decides who is at
 * fault. An evidence-analysis failure happens after a successful read, so it
 * names Trustlify; every other AI failure keeps the generic service line.
 */
export function safeFailureMessage(error: unknown, stage?: string): string {
  if (error instanceof InputValidationError) {
    return error.message;
  }
  if (error instanceof WebFetchError) {
    return describeContentFailure(contentFailureFromFetchError(error));
  }
  if (error instanceof AIError) {
    if (stage === "ANALYZING_EVIDENCE") {
      return EVIDENCE_ANALYSIS_FAILURE_MESSAGE;
    }
    return "The AI service could not complete this investigation. Please try again later.";
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
  if (error instanceof WebFetchError) {
    return error.code;
  }
  return undefined;
}

/* ─── Uploaded file loading (image/PDF inputs, spec 37/38) ────────────────── */

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

export class FileLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileLoadError";
  }
}

/**
 * Read an uploaded investigation file from Supabase storage as base64 for
 * Gemini multimodal claim extraction. Honest boundary: unsupported types and
 * unreadable files fail — nothing is faked.
 */
export async function loadFileFromStorage(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const lowered = filePath.toLowerCase();
  const extension = Object.keys(MIME_BY_EXTENSION).find((ext) =>
    lowered.endsWith(ext),
  );
  if (!extension) {
    throw new FileLoadError(
      "This file type is not supported for investigation yet — images (PNG, JPEG, WebP, GIF) and PDF are supported.",
    );
  }
  const mimeType = MIME_BY_EXTENSION[extension]!;

  const { data, error } = await supabaseAdmin.storage
    .from("trustlify-uploads")
    .download(filePath);

  if (error || !data) {
    throw new FileLoadError("The uploaded file could not be read.");
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new FileLoadError("The uploaded file is empty.");
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new FileLoadError(
      `The uploaded file exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB limit.`,
    );
  }

  return { base64: buffer.toString("base64"), mimeType };
}

/* ─── Executor ────────────────────────────────────────────────────────────── */

export interface InvestigationRunResult {
  investigationId: string;
  finalStatus: "complete" | "failed";
  finalStage: string;
  claimCount: number;
  sourceCount: number;
  evidenceCount: number;
  verdict: Verdict | null;
  trustScore: number | null;
  searchQueries: string[];
  errorMessage: string | null;
  /**
   * Explicit category of a content failure (invalid link, blocked, unusable
   * content…), null when the failure was something else. Structured companion
   * to `errorMessage` so callers can branch on the cause, not on prose.
   */
  failureCode: ContentFailureCode | null;
  /**
   * Provider category of an evidence-analysis failure, null otherwise. Kept
   * separate from `failureCode` on purpose: `failureCode` classifies failures
   * to READ content, while an analysis failure happens after the content was
   * read successfully — so the two must never be conflated by a caller.
   */
  aiFailureCode: AIErrorCode | null;
}

/**
 * Run the investigation to completion (or honest failure).
 *
 * Every stage transition is persisted so polling clients observe real state.
 * The function never throws — failures are captured, logged, and persisted.
 */
export async function runInvestigation(
  investigationId: string,
  deps: ExecutorDeps,
  store: ExecutorStore,
): Promise<InvestigationRunResult> {
  let stage: string = "NORMALIZING";
  let searchQueries: string[] = [];
  let claimCount = 0;
  let sourceCount = 0;
  let evidenceCount = 0;
  let verdict: Verdict | null = null;
  let trustScore: number | null = null;

  const fail = async (
    error: unknown,
    /** Category decided by a call site (e.g. unusable content). */
    failure?: ContentFailure,
  ): Promise<InvestigationRunResult> => {
    const classified = failure ?? contentFailureFrom(error) ?? undefined;
    // Only an AI failure inside the analysis stage is an analysis outage; the
    // page itself was already read at that point.
    const aiFailureCode =
      stage === "ANALYZING_EVIDENCE" && error instanceof AIError
        ? error.code
        : null;
    const message =
      error instanceof FileLoadError
        ? error.message
        : classified
          ? describeContentFailure(classified)
          : safeFailureMessage(error, stage);
    logger.error("Investigation failed", {
      investigationId,
      stage,
      code: classified?.code ?? errorCodeOf(error),
      // Provider messages are already scrubbed of secrets by the providers.
      detail:
        error instanceof AIError ||
        error instanceof SearchError ||
        error instanceof WebFetchError ||
        error instanceof FileLoadError
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
      evidenceCount,
      verdict,
      trustScore,
      searchQueries,
      errorMessage: message,
      failureCode: classified?.code ?? null,
      aiFailureCode,
    };
  };

  try {
    const investigation = await store.loadInvestigation(investigationId);
    if (!investigation) {
      return await fail(new Error("Investigation row not found"));
    }

    /* ── Stage: NORMALIZING (set by the start endpoint before this runs) ── */
    let normalized: NormalizedInput;
    try {
      normalized = normalizeInvestigationInput({
        inputType: investigation.inputType,
        inputText: investigation.inputText ?? undefined,
        inputFilePath: investigation.inputFilePath ?? undefined,
      });
    } catch (normalizationError) {
      // A link the pipeline cannot even name is the user's most fixable
      // problem, so it gets the explicit category instead of a raw schema line.
      if (investigation.inputType === "url") {
        return await fail(normalizationError, {
          code: "INVALID_URL",
          // Our own validation text — never the submitted value itself.
          reason:
            normalizationError instanceof InputValidationError
              ? normalizationError.message
              : undefined,
        });
      }
      return await fail(normalizationError);
    }

    /* ── Stage: EXTRACTING_CONTENT — obtain the actual content ── */
    let contentText: string | null = null;
    let fileBase64: string | undefined;
    let fileMimeType: string | undefined;
    let domainChanged = false;
    let originalDomain: string | null = null;
    let finalDomain: string | null = null;
    /**
     * The submitted page once its content is actually in hand. Kept for the
     * evidence stages: the page the user named must not be dropped after claim
     * extraction, and it is reused here WITHOUT fetching it a second time.
     */
    let submittedPage: FetchedWebContent | null = null;

    if (normalized.type === "url") {
      stage = "EXTRACTING_CONTENT";
      await store.updateInvestigation(investigationId, { currentStage: stage });

      // Real page content — never claims from the URL string (spec 07)
      const fetched = await deps.fetchContent(normalized.sourceUrl!);
      submittedPage = fetched;
      contentText = fetched.text;
      domainChanged = fetched.domainChanged;
      originalDomain = fetched.originalDomain;
      finalDomain = fetched.finalDomain;

      // Redirect signal (spec 11) — a signal, never automatically malicious
      await store.updateInvestigation(investigationId, {
        originalUrl: fetched.originalUrl,
        finalUrl: fetched.finalUrl,
        originalDomain: fetched.originalDomain,
        finalDomain: fetched.finalDomain,
        domainChanged: fetched.domainChanged,
        contentTruncated: fetched.contentTruncated,
      });

      // A redirect (SUCCESS/REDIRECTED) continues normally — its details were
      // just persisted. Only unusable CONTENT stops the investigation, and it
      // stops here with the specific reason rather than as a later, vaguer
      // failure or a wasted AI request.
      const outcome = contentOutcomeOf(fetched);
      if (isContentFailureCode(outcome)) {
        return await fail(new Error(`submitted page: ${outcome}`), { code: outcome });
      }
    } else if (normalized.type === "image" || normalized.type === "pdf") {
      stage = "EXTRACTING_CONTENT";
      await store.updateInvestigation(investigationId, { currentStage: stage });

      // Multimodal extraction via existing Gemini file support (spec 37/38)
      const file = await deps.loadFile(investigation.inputFilePath!);
      fileBase64 = file.base64;
      fileMimeType = file.mimeType;
      // Any text the user attached alongside the file is kept in the SAME
      // investigation and sent with it — still exactly one claim-extraction call.
      contentText = normalized.content;
    } else {
      contentText = normalized.content;
    }

    if (!contentText && !fileBase64) {
      return await fail(
        new InputValidationError("Input content is empty after normalization"),
        { code: "EMPTY_CONTENT" },
      );
    }

    /* ── Stage: EXTRACTING_CLAIMS — exactly ONE Gemini request ── */
    stage = "EXTRACTING_CLAIMS";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const extraction = await deps.ai.extractClaims({
      text: contentText ?? "",
      inputType: normalized.type,
      ...(fileBase64 ? { fileBase64, fileMimeType } : {}),
    });

    const extracted = extraction.claims.slice(0, MAX_CLAIMS);
    if (extracted.length === 0) {
      return await fail(
        new InputValidationError("No claims could be extracted from this input"),
      );
    }

    const persistedClaims = await store.insertClaims(investigationId, extracted);
    claimCount = persistedClaims.length;

    // Deterministic ranking — never a second AI call (spec 13)
    const ranked = rankClaims(persistedClaims);
    const selectedClaim = ranked[0];
    await store.updateInvestigation(investigationId, {
      selectedClaimId: selectedClaim.id,
    });

    /* ── Stage: SEARCHING — ≤3 deterministic targeted queries ── */
    stage = "SEARCHING";
    const planned = planSearchQueries(ranked);
    searchQueries = planned.map((entry) => entry.query);
    await store.updateInvestigation(investigationId, {
      currentStage: stage,
      searchQuery: searchQueries.join(" | "),
    });

    const collectedResults: {
      title: string;
      url: string;
      snippet: string;
    }[] = [];
    for (const plannedQuery of planned) {
      const searchOutput = await deps.search.search({
        query: plannedQuery.query,
        maxResults: SEARCH_MAX_RESULTS,
      });
      collectedResults.push(...searchOutput.results);

      // Spec 15: stop searching once a strong official source is found
      const hasStrongOfficial = searchOutput.results.some((result) => {
        const type = result.url;
        return /\.(gov|edu)(\.|$)/i.test(safeHostname(type)) || isGovernmentOrAcademic(type);
      });
      if (hasStrongOfficial) break;
    }

    // ⚠ Search results are UNTRUSTED DATA from here on (spec 12)
    const normalizedSources = dedupeSources(
      normalizeSearchSources(collectedResults),
    );

    // ONE evidence universe = the submitted original page + the Tavily
    // discoveries. The submitted page is already fetched, so reusing that same
    // response adds no network request; a discovery pointing at the same page
    // is dropped so it is never counted (or fetched) twice.
    const submittedSource = submittedSourceFrom(submittedPage);
    const submittedKey = submittedSource
      ? canonicalUrlKey(submittedSource.url)
      : "";
    const discoveredSources = submittedKey
      ? normalizedSources.filter(
          (source) => canonicalUrlKey(source.url) !== submittedKey,
        )
      : normalizedSources;
    const evidenceSources: NormalizedSource[] = submittedSource
      ? [submittedSource, ...discoveredSources]
      : discoveredSources;

    /* ── Stage: READING_SOURCES — persist sources, fetch selected content ── */
    stage = "READING_SOURCES";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const persistedSources = await store.insertSources(
      investigationId,
      evidenceSources,
    );
    sourceCount = persistedSources.length;

    // Deterministic selection of ≤3 sources for content fetching (spec 18).
    // Only discoveries are candidates: the submitted page is already in hand,
    // so the fetch budget is unchanged and no page is fetched twice.
    const selectedForFetch = selectSourcesForFetch(
      discoveredSources,
      env.INVESTIGATION_MAX_SOURCE_FETCHES,
    );

    const fetchedContentBySourceId = new Map<string, FetchedWebContent>();

    if (submittedSource && submittedPage) {
      const persistedSubmitted = persistedSources.find(
        (source) =>
          source.sourceType === "submitted" &&
          source.url === submittedSource.url,
      );
      if (persistedSubmitted) {
        // First entry of the evidence set, carrying the content already read
        // during EXTRACTING_CONTENT — a real passage for Gemini, not a snippet.
        fetchedContentBySourceId.set(persistedSubmitted.id, submittedPage);
        await store.updateSourceContent(persistedSubmitted.id, {
          accessStatus: "available",
          publishedAt: submittedPage.publishedAt,
        });
      }
    }

    for (const source of selectedForFetch) {
      const persisted = persistedSources.find(
        (row) => row.url === source.url,
      );
      if (!persisted) continue;

      try {
        const fetched = await deps.fetchContent(source.url);
        fetchedContentBySourceId.set(persisted.id, fetched);
        await store.updateSourceContent(persisted.id, {
          accessStatus: "available",
          publishedAt: fetched.publishedAt,
        });
      } catch (fetchError) {
        // Keep the metadata; mark content unavailable; never treat the
        // snippet as full evidence (spec 33)
        logger.warn("Source content fetch failed", {
          investigationId,
          sourceId: persisted.id,
          domain: persisted.domain,
          code: fetchError instanceof WebFetchError ? fetchError.code : undefined,
        });
        await store.updateSourceContent(persisted.id, { accessStatus: "error" });
      }
    }

    /* ── Stage: ANALYZING_EVIDENCE — the ONE Gemini reasoning call ── */
    stage = "ANALYZING_EVIDENCE";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const investigatorSources: InvestigatorSource[] = [...fetchedContentBySourceId]
      .map(([sourceId, fetched]) => {
        const persisted = persistedSources.find((row) => row.id === sourceId);
        if (!persisted) return null;
        return {
          id: persisted.id,
          url: persisted.url,
          title: fetched.title ?? persisted.title,
          domain: persisted.domain,
          sourceType: persisted.sourceType as InvestigatorSource["sourceType"],
          content: fetched.text,
        } satisfies InvestigatorSource;
      })
      .filter((source): source is InvestigatorSource => source !== null);

    let validatedEvidence: VerifiedEvidence[] = [];
    if (investigatorSources.length > 0) {
      const analysisClaims: InvestigatorClaim[] = ranked
        .slice(0, MAX_ANALYSIS_CLAIMS)
        .map((claim) => ({
          id: claim.id,
          text: claim.text,
          type: claim.type,
          importance: claim.importance,
        }));

      let analysis: AnalyzeEvidenceOutput;
      try {
        analysis = await deps.ai.analyzeEvidence({
          claims: analysisClaims.map((claim) => ({
            id: claim.id,
            text: claim.text,
            type: claim.type as never,
          })),
          sources: investigatorSources.map((source) => ({
            id: source.id,
            url: source.url,
            domain: source.domain,
            sourceType: source.sourceType,
            title: source.title,
          })),
          passages: investigatorSources.map((source) => ({
            sourceId: source.id,
            text: source.content,
          })),
        });
      } catch (analysisError) {
        // Spec 33 forbids inventing relationships — it does not permit keeping
        // quiet about a missing analysis. The content was read; only our
        // reasoning failed, so the real cause is preserved and the run stops
        // here instead of completing as an UNVERIFIED verdict about the site.
        logger.error("Evidence analysis failed — the investigation cannot be judged", {
          investigationId,
          code: analysisError instanceof AIError ? analysisError.code : undefined,
          detail:
            analysisError instanceof AIError ? analysisError.message : undefined,
        });
        return await fail(analysisError);
      }

      if (analysis.evidence.length === 0) {
        // Zero items is not "the evidence is insufficient": an analysis that
        // classified nothing produced no verdict at all. The provider contract
        // rejects this shape too (see analyzeEvidenceResponseSchema); this guard
        // keeps the outcome identical for any other provider implementation.
        return await fail(
          new AIError(
            "AI_MALFORMED_OUTPUT",
            "Evidence analysis returned no items for the supplied claims and passages",
          ),
        );
      }

      // Validate the model's output — never trust it blindly (spec 21).
      // Rejections drop individual items: surviving evidence still stands, and
      // only a total absence of usable analysis stops the investigation.
      const validated = validateEvidenceAnalysis({
        candidates: analysis.evidence,
        claims: analysisClaims,
        sources: investigatorSources,
      });
      validatedEvidence = validated.evidence;
      if (validatedEvidence.length === 0) {
        // A non-empty response whose every item was rejected is not evidence
        // insufficiency about the website. It is an unusable AI analysis and
        // must not quietly become a completed UNVERIFIED investigation.
        return await fail(
          new AIError(
            "AI_MALFORMED_OUTPUT",
            "Evidence analysis contained no usable items for the supplied claims and passages",
          ),
        );
      }
      if (validated.rejectedCount > 0) {
        logger.warn("Evidence analysis items rejected", {
          investigationId,
          rejected: validated.rejectedCount,
        });
      }
    }

    if (validatedEvidence.length > 0) {
      await store.insertEvidence(
        investigationId,
        validatedEvidence.map((item) => ({
          claimId: item.claimId,
          sourceId: item.sourceId,
          relation: item.relation,
          excerpt: item.excerpt,
          reason: item.reason,
          confidence: item.confidence,
          verificationStatus: item.verificationStatus,
        })),
      );
      evidenceCount = validatedEvidence.length;
    }

    // Deterministic claim statuses over ALL claims (spec 23)
    const claimStatuses = deriveClaimStatuses({
      claims: persistedClaims.map((claim) => ({
        id: claim.id,
        text: claim.text,
        type: claim.type,
        importance: claim.importance,
      })),
      evidence: validatedEvidence,
      sources: investigatorSources,
    });
    await store.updateClaims(claimStatuses);

    /* ── Stage: CALCULATING_TRUST — the deterministic Trust Engine ── */
    stage = "CALCULATING_TRUST";
    await store.updateInvestigation(investigationId, { currentStage: stage });

    const claimsForEngine = persistedClaims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      type: claim.type,
      importance: claim.importance,
      status:
        claimStatuses.find((entry) => entry.claimId === claim.id)?.status ??
        "insufficient",
    }));

    const sourcesForEngine = persistedSources.map((source) => ({
      id: source.id,
      domain: source.domain,
      sourceType: source.sourceType,
    }));

    const currentness = assessInvestigationCurrentness(
      persistedSources.map((source) => ({
        sourceId: source.id,
        publishedAt:
          (fetchedContentBySourceId.get(source.id)?.publishedAt as string | null) ??
          null,
        retrievedAt: source.retrievedAt,
      })),
    );

    // First-party hosts known for THIS investigation: the host the user
    // submitted and the host it finally resolved to. Empty unless a page was
    // actually submitted and fetched — discoveries never invent one.
    const firstPartyDomains = [
      safeHostname(submittedPage?.originalUrl ?? ""),
      safeHostname(submittedPage?.finalUrl ?? ""),
    ].filter(Boolean);

    const supportedSourceIds = new Set(
      validatedEvidence
        .filter((item) => item.relation === "supports")
        .map((item) => item.sourceId),
    );
    // One authority definition for the whole investigation: the Trust Engine
    // gate (government / academic / first-party) also decides whether the risk
    // layer may report "no official source confirms this". A genuine
    // organization's own page IS official confirmation of its own identity —
    // it still needs real supporting evidence for that, as before.
    const hasAuthoritativeSupport = sourcesForEngine.some(
      (source) =>
        isAuthoritativeSource(source, firstPartyDomains) &&
        supportedSourceIds.has(source.id),
    );

    const riskSignals = detectRiskSignals({
      domainChanged,
      originalDomain,
      finalDomain,
      claims: claimsForEngine,
      sourceTypes: sourcesForEngine.map((source) => source.sourceType),
      hasAuthoritativeSupport,
    });

    const decision = calculateTrustDecision({
      claims: claimsForEngine,
      evidence: validatedEvidence.map((item) => ({
        claimId: item.claimId,
        sourceId: item.sourceId,
        relation: item.relation,
        confidence: item.confidence,
      })),
      sources: sourcesForEngine,
      riskSignals,
      currentness: currentness.overall,
      domainChanged,
      originalDomain,
      finalDomain,
      firstPartyDomains,
    });
    verdict = decision.verdict;
    trustScore = decision.trustScore;

    /* ── Stage: COMPLETE ── */
    stage = "COMPLETE";
    await store.updateInvestigation(investigationId, {
      status: "complete",
      currentStage: stage,
      verdict: decision.verdict,
      trustScore: decision.trustScore,
    });
    await store.insertDecision(investigationId, {
      verdict: decision.verdict,
      trustScore: decision.trustScore,
      explanation: decision.explanation,
      recommendedAction: decision.recommendedAction,
      reasons: decision.reasons,
    });

    logger.info("Investigation completed", {
      investigationId,
      claimCount,
      sourceCount,
      evidenceCount,
      verdict: decision.verdict,
      trustScore: decision.trustScore,
    });

    return {
      investigationId,
      finalStatus: "complete",
      finalStage: "COMPLETE",
      claimCount,
      sourceCount,
      evidenceCount,
      verdict: decision.verdict,
      trustScore: decision.trustScore,
      searchQueries,
      errorMessage: null,
      failureCode: null,
      aiFailureCode: null,
    };
  } catch (error) {
    return await fail(error);
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isGovernmentOrAcademic(url: string): boolean {
  const hostname = safeHostname(url);
  const labels = hostname.split(".").filter(Boolean);
  const last = labels[labels.length - 1];
  const secondToLast = labels.length >= 2 ? labels[labels.length - 2] : undefined;
  return last === "gov" || secondToLast === "gov" || last === "edu" || secondToLast === "edu" || secondToLast === "ac";
}

/**
 * Turn the already-fetched submitted page into a first-class investigation
 * source so it can carry evidence. 'submitted' is assigned because the USER
 * named this page and its content is genuinely in hand — it is a first-party
 * relationship, not a guess from a `.org`/`.com`/`.io` hostname. Returns null
 * when there is no fetched page (text/image/PDF inputs), which leaves the
 * evidence universe exactly as it was.
 */
function submittedSourceFrom(
  fetched: FetchedWebContent | null,
): NormalizedSource | null {
  if (!fetched) return null;

  const host = safeHostname(fetched.finalUrl).replace(/^www\./, "");
  // No host or no readable content → no source row is fabricated (spec 10).
  if (!host || fetched.text.trim().length === 0) return null;

  return {
    title: (fetched.title?.trim() || host).slice(0, 300),
    url: fetched.finalUrl,
    domain: host,
    // A submitted page has no search snippet, and its page text is never
    // relabelled as one — the evidence tab shows its real verified excerpts.
    snippet: "",
    sourceType: "submitted",
    retrievedAt: new Date().toISOString(),
  };
}

/* ─── Background entry point ──────────────────────────────────────────────── */

/**
 * Launch the investigation in the background (fire-and-forget) from the
 * start endpoint. In-process async execution — no queues, no Redis (spec 15).
 * If the process restarts mid-run, the row remains 'processing'; recovery of
 * in-flight jobs is deliberately out of scope for this phase.
 */
export function runInvestigationInBackground(investigationId: string): void {
  const deps: ExecutorDeps = {
    ai: new GeminiProvider(),
    search: new TavilySearchProvider(),
    fetchContent: (url: string) => fetchWebContent(url),
    loadFile: loadFileFromStorage,
  };

  void runInvestigation(
    investigationId,
    deps,
    createSupabaseExecutorStore(),
  ).catch((error) => {
    // Last-resort guard: runInvestigation captures its own failures.
    logger.error("Investigation executor crashed", {
      investigationId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
