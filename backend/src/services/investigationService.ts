/**
 * Trustlify Backend — Investigation Service
 *
 * Phase 2: Supabase-backed investigation persistence.
 * Phase 3C: startInvestigation kicks off the real mini pipeline (executor)
 * and getInvestigation returns the full live state — claims, sources,
 * evidence, and derived events. The backend state is authoritative.
 */

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";
import { runInvestigationInBackground } from "../investigation/executor.js";
import { deriveInvestigationEvents } from "../investigation/events.js";
import type { CreateInvestigationInput } from "../validators/investigation.js";

/**
 * Create a new investigation in the database.
 */
export async function createInvestigation(
  userId: string,
  input: CreateInvestigationInput,
): Promise<{ id: string; status: string }> {
  const { data, error } = await supabaseAdmin
    .from("investigations")
    .insert({
      user_id: userId,
      input_type: input.inputType,
      input_text: input.inputText ?? null,
      input_file_path: input.inputFilePath ?? null,
      status: "created",
      current_stage: "NORMALIZING",
    })
    .select("id, status")
    .single();

  if (error) {
    throw new AppError(500, "INVESTIGATION_CREATE_FAILED", "Failed to create investigation");
  }

  return { id: data.id, status: data.status };
}

/**
 * Start the investigation pipeline.
 * Flips status to 'processing' (stage NORMALIZING) and launches the Phase 3C
 * mini-investigation executor in the background — fire-and-forget, no queues
 * (spec 15). Clients poll GET /:id for real progress.
 */
export async function startInvestigation(
  id: string,
  userId: string,
): Promise<{ status: string }> {
  // Verify ownership first
  const inv = await getInvestigationRow(id, userId);

  if (inv.status !== "created") {
    throw new AppError(400, "INVALID_STATE", `Investigation is already in status: ${inv.status}`);
  }

  const { data, error } = await supabaseAdmin
    .from("investigations")
    .update({ status: "processing", current_stage: "NORMALIZING", error_message: null })
    .eq("id", id)
    .eq("user_id", userId)
    .select("status")
    .single();

  if (error) {
    throw new AppError(500, "INVESTIGATION_START_FAILED", "Failed to start investigation");
  }

  // Async execution — the executor persists every stage transition.
  runInvestigationInBackground(id);

  return { status: data.status };
}

/**
 * Get the full current state of an investigation: status, stage, claims,
 * sources, evidence, and derived events. All child rows are read from
 * Supabase — no in-memory caching, so polling always reflects real state.
 */
export async function getInvestigation(
  id: string,
  userId: string,
) {
  const inv = await getInvestigationRow(id, userId);

  const [claimRows, sourceRows, evidenceRows] = await Promise.all([
    fetchClaimRows(id),
    fetchSourceRows(id),
    fetchEvidenceRows(id),
  ]);

  const events = deriveInvestigationEvents({
    investigationId: inv.id,
    claims: claimRows.map((row) => ({ id: row.id, createdAt: row.created_at })),
    sources: sourceRows.map((row) => ({ id: row.id, createdAt: row.created_at })),
    createdAt: inv.created_at,
    status: inv.status,
    currentStage: inv.current_stage ?? "NORMALIZING",
    updatedAt: inv.updated_at,
    searchQuery: inv.search_query ?? null,
    selectedClaimId: inv.selected_claim_id ?? null,
  });

  return {
    id: inv.id,
    userId: inv.user_id,
    inputType: inv.input_type,
    inputText: inv.input_text,
    inputFilePath: inv.input_file_path,
    status: inv.status,
    currentStage: inv.current_stage,
    verdict: inv.verdict,
    trustScore: inv.trust_score,
    searchQuery: inv.search_query ?? null,
    selectedClaimId: inv.selected_claim_id ?? null,
    errorMessage: inv.error_message ?? null,
    claims: claimRows.map((row) => ({
      id: row.id,
      investigationId: row.investigation_id,
      text: row.claim_text,
      type: row.claim_type,
      importance: row.importance,
      status: row.verification_status,
      reasoningSummary: row.reasoning_summary,
      createdAt: row.created_at,
    })),
    sources: sourceRows.map((row) => ({
      id: row.id,
      investigationId: row.investigation_id,
      url: row.url,
      title: row.title,
      domain: row.domain,
      sourceType: row.source_type,
      snippet: row.snippet,
      publisher: row.publisher,
      publishedAt: row.published_at,
      retrievedAt: row.retrieved_at,
      createdAt: row.created_at,
    })),
    evidence: evidenceRows.map((row) => ({
      id: row.id,
      claimId: row.claim_id,
      sourceId: row.source_id,
      excerpt: row.excerpt,
      relation: row.relation,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
    })),
    events,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  };
}

async function fetchClaimRows(investigationId: string) {
  const { data, error } = await supabaseAdmin
    .from("claims")
    .select("id, investigation_id, claim_text, claim_type, importance, verification_status, reasoning_summary, created_at")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "INVESTIGATION_CLAIMS_FAILED", "Failed to load investigation claims");
  }
  return data ?? [];
}

async function fetchSourceRows(investigationId: string) {
  const { data, error } = await supabaseAdmin
    .from("sources")
    .select("id, investigation_id, url, title, domain, source_type, snippet, publisher, published_at, retrieved_at, created_at")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "INVESTIGATION_SOURCES_FAILED", "Failed to load investigation sources");
  }
  return data ?? [];
}

async function fetchEvidenceRows(investigationId: string) {
  // Evidence rows are joined through claims (evidence references claim ids).
  const { data, error } = await supabaseAdmin
    .from("evidence")
    .select("id, claim_id, source_id, excerpt, relation, verification_status, created_at, claims!inner(investigation_id)")
    .eq("claims.investigation_id", investigationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "INVESTIGATION_EVIDENCE_FAILED", "Failed to load investigation evidence");
  }
  return (
    (data ?? []).map((row: Record<string, unknown> & { claims?: unknown }) => {
      const { claims: _joined, ...rest } = row;
      return rest as {
        id: string;
        claim_id: string;
        source_id: string;
        excerpt: string | null;
        relation: string;
        verification_status: string;
        created_at: string;
      };
    }) ?? []
  );
}

/**
 * Re-check a completed investigation.
 * Honest boundary: re-investigation (change detection over time) belongs to a
 * later phase. Previously this placeholder flipped the row back to
 * 'processing' without running anything — a fake state this phase removes.
 */
export async function recheckInvestigation(
  _id: string,
  _userId: string,
): Promise<never> {
  throw new AppError(
    501,
    "NOT_IMPLEMENTED",
    "Re-checking investigations is not available yet — it arrives in a later phase",
  );
}

/**
 * List investigations for a user with pagination.
 */
export async function listInvestigations(
  userId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = options;

  const { data, error, count } = await supabaseAdmin
    .from("investigations")
    .select("id, user_id, input_type, input_text, status, current_stage, verdict, trust_score, created_at, updated_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError(500, "INVESTIGATION_LIST_FAILED", "Failed to list investigations");
  }

  const investigations = (data ?? []).map((inv) => ({
    id: inv.id,
    userId: inv.user_id,
    inputType: inv.input_type,
    inputText: inv.input_text,
    status: inv.status,
    currentStage: inv.current_stage,
    verdict: inv.verdict,
    trustScore: inv.trust_score,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  }));

  return { investigations, total: count ?? 0 };
}

/**
 * Internal: fetch an investigation row and verify ownership.
 */
async function getInvestigationRow(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("investigations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    throw new AppError(404, "NOT_FOUND", "Investigation not found");
  }

  if (data.user_id !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this investigation");
  }

  return data;
}
