/**
 * Trustlify Backend — Investigation Service
 *
 * Phase 2: Supabase-backed investigation persistence.
 * Phase 4: startInvestigation kicks off the real evidence-driven pipeline
 * (executor) and getInvestigation returns the full live state — input, URL
 * fetch signals, claims, sources, evidence, the deterministic trust decision,
 * and derived events. The backend state is authoritative.
 */

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";
import { runInvestigationInBackground } from "../investigation/executor.js";
import { deriveInvestigationEvents } from "../investigation/events.js";
import { deriveStudentIntelligence } from "./studentIntelligenceService.js";
import * as profileService from "./profileService.js";
import type { CreateInvestigationInput } from "../validators/investigation.js";

/**
 * Create a new investigation in the database.
 *
 * The optional user question is stored in its own column — never merged into
 * input_text, which is the untrusted material the claims are extracted from.
 * It is written only when actually provided, so investigations created without
 * one are byte-for-byte the same as before.
 */
export async function createInvestigation(
  userId: string,
  input: CreateInvestigationInput,
): Promise<{ id: string; status: string }> {
  const baseRow = {
    user_id: userId,
    input_type: input.inputType,
    input_text: input.inputText ?? null,
    input_file_path: input.inputFilePath ?? null,
    status: "created",
    current_stage: "NORMALIZING",
  };

  let payload: Record<string, unknown> = baseRow;
  if (input.investigationQuestion) {
    payload = { ...baseRow, investigation_question: input.investigationQuestion };
  }

  let { data, error } = await supabaseAdmin
    .from("investigations")
    .insert(payload)
    .select("id, status")
    .single();

  // The question column arrives with migration 004. If it is not applied yet,
  // the investigation itself must still be created — retry without it.
  if (error && input.investigationQuestion && isMissingColumnError(error)) {
    console.warn(
      "[investigations] investigation_question column missing — apply supabase/migrations/004_student_intelligence.sql. Creating investigation without the question.",
    );
    ({ data, error } = await supabaseAdmin
      .from("investigations")
      .insert(baseRow)
      .select("id, status")
      .single());
  }

  if (error || !data) {
    throw new AppError(500, "INVESTIGATION_CREATE_FAILED", "Failed to create investigation");
  }

  return { id: data.id, status: data.status };
}

/** Postgres 42703 = undefined column (SQLSTATE carried by Supabase errors). */
function isMissingColumnError(error: unknown): boolean {
  const coded = error as { code?: string; message?: string } | null;
  return (
    coded?.code === "42703" ||
    /investigation_question/i.test(coded?.message ?? "")
  );
}

/**
 * Start the investigation pipeline.
 * Flips status to 'processing' (stage NORMALIZING) and launches the Phase 4
 * evidence-driven executor in the background — fire-and-forget, no queues
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
 * Get the full current state of an investigation: status, stage, input, URL
 * fetch signals, claims, sources, evidence, the trust decision, and derived
 * events. All child rows are read from Supabase — no in-memory caching, so
 * polling always reflects real state.
 *
 * Once the investigation is complete, the student-intelligence payload is
 * derived from the rows fetched above (question intent, currentness/deadline,
 * student match, recommended source). That derivation is pure and deterministic
 * — no extra AI/search call, and results survive a refresh unchanged. The
 * student profile is read only for the student role, so general users trigger
 * no additional query at all.
 */
export async function getInvestigation(
  id: string,
  userId: string,
  options: { role?: string | null } = {},
) {
  const inv = await getInvestigationRow(id, userId);

  const [claimRows, sourceRows, evidenceRows, decisionRow] = await Promise.all([
    fetchClaimRows(id),
    fetchSourceRows(id),
    fetchEvidenceRows(id),
    fetchDecisionRow(id),
  ]);

  const claims = claimRows.map((row) => ({
    id: row.id,
    investigationId: row.investigation_id,
    text: row.claim_text,
    type: row.claim_type,
    importance: row.importance,
    status: row.verification_status,
    reasoningSummary: row.reasoning_summary,
    createdAt: row.created_at,
  }));

  const sources = sourceRows.map((row) => ({
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
    accessStatus: row.access_status,
    createdAt: row.created_at,
  }));

  const evidence = evidenceRows.map((row) => ({
    id: row.id,
    claimId: row.claim_id,
    sourceId: row.source_id,
    excerpt: row.excerpt,
    relation: row.relation,
    reason: row.reason,
    confidence: row.confidence,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  }));

  const investigationQuestion =
    typeof inv.investigation_question === "string" &&
    inv.investigation_question.trim()
      ? inv.investigation_question
      : null;

  const studentIntelligence = await buildStudentIntelligence({
    status: inv.status,
    investigationQuestion,
    claims,
    sources,
    evidence,
    decision: decisionRow,
    submittedDomain: inv.original_domain ?? inv.final_domain ?? null,
    userId,
    role: options.role ?? null,
  });

  const events = deriveInvestigationEvents({
    investigationId: inv.id,
    inputType: inv.input_type,
    claims: claimRows.map((row) => ({ id: row.id, createdAt: row.created_at })),
    sources: sourceRows.map((row) => ({ id: row.id, createdAt: row.created_at })),
    evidence: evidenceRows.map((row) => ({
      id: row.id,
      claimId: row.claim_id,
      sourceId: row.source_id,
      createdAt: row.created_at,
    })),
    createdAt: inv.created_at,
    status: inv.status,
    currentStage: inv.current_stage ?? "NORMALIZING",
    updatedAt: inv.updated_at,
    searchQuery: inv.search_query ?? null,
    verdict: inv.verdict ?? null,
    errorMessage: inv.error_message ?? null,
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
    searchQueries: parseSearchQueries(inv.search_query),
    selectedClaimId: inv.selected_claim_id ?? null,
    errorMessage: inv.error_message ?? null,
    // URL fetch signals (spec 08/11) — a signal, never automatically malicious
    originalUrl: inv.original_url ?? null,
    finalUrl: inv.final_url ?? null,
    originalDomain: inv.original_domain ?? null,
    finalDomain: inv.final_domain ?? null,
    domainChanged: inv.domain_changed ?? false,
    contentTruncated: inv.content_truncated ?? false,
    claims,
    sources,
    evidence,
    decision: decisionRow,
    events,
    // Student intelligence — derived read-time, null while still running
    investigationQuestion,
    studentIntelligence,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  };
}

interface BuildIntelligenceArgs {
  status: string;
  investigationQuestion: string | null;
  claims: { id: string; text: string; type: string }[];
  sources: {
    id: string;
    url: string;
    title: string;
    domain: string;
    sourceType: string;
    publishedAt: string | null;
    retrievedAt: string | null;
    accessStatus: string | null;
  }[];
  evidence: { sourceId: string; relation: string; confidence: string | null }[];
  decision: DecisionPayload | null;
  submittedDomain: string | null;
  userId: string;
  role: string | null;
}

/**
 * Derive the student-intelligence payload for a COMPLETED investigation.
 *
 * Returns null while the investigation is still running or failed, so the
 * result page and the progress page behave exactly as before until a verdict
 * exists. Any problem inside the derivation degrades to null rather than
 * breaking the investigation read — the stored result is never at risk.
 */
async function buildStudentIntelligence(args: BuildIntelligenceArgs) {
  if (args.status !== "complete") return null;

  try {
    // Only students need the profile; general users see the existing result.
    const profile =
      String(args.role ?? "").toLowerCase() === "student"
        ? await profileService.getProfile(args.userId)
        : null;

    return deriveStudentIntelligence({
      investigationQuestion: args.investigationQuestion,
      claims: args.claims,
      sources: args.sources,
      evidence: args.evidence,
      decision: args.decision
        ? {
            verdict: args.decision.verdict,
            trustScore: args.decision.trustScore,
            recommendedAction: args.decision.recommendedAction,
            reasons: args.decision.reasons,
          }
        : null,
      submittedDomain: args.submittedDomain,
      profile: profile
        ? {
            role: profile.role,
            education: profile.education,
            age: profile.age,
            location: profile.location,
            skills: profile.skills,
            interests: profile.interests,
            experience: profile.experience,
            portfolioUrl: profile.portfolioUrl,
            language: profile.language,
          }
        : null,
    });
  } catch (error) {
    console.error("[investigations] student intelligence derivation failed", error);
    return null;
  }
}

/** The executor persists queries joined with " | " — split them back apart. */
function parseSearchQueries(joined: string | null | undefined): string[] {
  if (!joined) return [];
  return joined.split(" | ").map((entry) => entry.trim()).filter(Boolean);
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
    .select("id, investigation_id, url, title, domain, source_type, snippet, publisher, published_at, retrieved_at, access_status, created_at")
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
    .select("id, claim_id, source_id, excerpt, relation, reason, confidence, verification_status, created_at, claims!inner(investigation_id)")
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
        reason: string | null;
        confidence: string | null;
        verification_status: string;
        created_at: string;
      };
    }) ?? []
  );
}

interface DecisionPayload {
  verdict: string;
  trustScore: number;
  explanation: string | null;
  recommendedAction: string[];
  reasons: string[];
  createdAt: string;
}

/**
 * The most recent persisted trust decision for an investigation (spec 36).
 * Returns null while the investigation is still running.
 */
async function fetchDecisionRow(investigationId: string): Promise<DecisionPayload | null> {
  const { data, error } = await supabaseAdmin
    .from("decisions")
    .select("verdict, trust_score, explanation, recommended_action, reasons, created_at")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "INVESTIGATION_DECISION_FAILED", "Failed to load investigation decision");
  }
  if (!data) return null;

  return {
    verdict: data.verdict,
    trustScore: data.trust_score,
    explanation: data.explanation,
    recommendedAction: data.recommended_action ?? [],
    reasons: data.reasons ?? [],
    createdAt: data.created_at,
  };
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
