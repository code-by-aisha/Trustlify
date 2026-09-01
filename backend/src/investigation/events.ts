/**
 * Trustlify Backend — Investigation Event Model
 *
 * Phase 4: internal event representation derived from persisted investigation
 * rows. Events are generated ONLY for real occurrences (a claim persisted, a
 * source discovered, an evidence item verified, a stage transition proven).
 *
 * These events support: live graph, activity timeline, investigation progress,
 * and audit trail. They are derived from the database, so they survive page
 * refreshes without a new storage system.
 *
 * WebSockets are intentionally NOT used — polling is acceptable this phase.
 */

export type InvestigationEventType =
  | "STAGE_CHANGED"
  | "CLAIM_CREATED"
  | "SOURCE_DISCOVERED"
  | "EVIDENCE_FOUND"
  | "INVESTIGATION_COMPLETED"
  | "INVESTIGATION_FAILED";

export interface InvestigationEvent {
  type: InvestigationEventType;
  investigationId: string;
  /** ISO timestamp of when the underlying real event happened. */
  timestamp: string;
  claimId?: string;
  sourceId?: string;
  /** Present on STAGE_CHANGED events. */
  stage?: string;
  /** Present on INVESTIGATION_FAILED events — safe, user-facing message. */
  reason?: string;
}

/* ─── Derivation from persisted rows ──────────────────────────────────────── */

export interface EventClaimRow {
  id: string;
  createdAt: string;
}

export interface EventSourceRow {
  id: string;
  createdAt: string;
}

export interface EventEvidenceRow {
  id: string;
  claimId: string;
  sourceId: string;
  createdAt: string;
}

/**
 * Derive the event stream from persisted investigation rows.
 * Deterministic: rows are ordered by timestamp then id, and events are emitted
 * in chronological stage order (stage entry first, then its child events).
 *
 * Stage-change events are synthesized ONLY for stages that provably happened
 * (spec 32 — no stage is reported without evidence of it in the data):
 *   NORMALIZING        — proven by the row's creation
 *   EXTRACTING_CONTENT — url/image/pdf input proven by extracted claims
 *                        (content must exist before claims do); text input has
 *                        no content-extraction stage
 *   EXTRACTING_CLAIMS  — proven by the existence of claim rows
 *   SEARCHING          — proven by a persisted search_query
 *   READING_SOURCES    — proven by the existence of source rows
 *   ANALYZING_EVIDENCE — proven by the existence of evidence rows
 *   CALCULATING_TRUST  — proven by a persisted verdict
 *   COMPLETE / FAILED  — proven by the investigation status
 *
 * While the investigation is still processing, the persisted currentStage is
 * appended as the live in-flight stage so polling clients see real progress.
 */
export function deriveInvestigationEvents(args: {
  investigationId: string;
  inputType: string;
  claims: EventClaimRow[];
  sources: EventSourceRow[];
  evidence: EventEvidenceRow[];
  createdAt: string;
  status: string;
  currentStage: string;
  updatedAt: string;
  /** Persisted search queries — proves the SEARCHING stage was entered. */
  searchQuery?: string | null;
  /** Persisted verdict — proves the CALCULATING_TRUST stage finished. */
  verdict?: string | null;
  /** Safe user-facing failure message on failed investigations. */
  errorMessage?: string | null;
}): InvestigationEvent[] {
  const {
    investigationId,
    createdAt,
    status,
    currentStage,
    updatedAt,
    searchQuery = null,
    verdict = null,
    errorMessage = null,
  } = args;

  const claims = [...args.claims].sort(byTimestampThenId);
  const sources = [...args.sources].sort(byTimestampThenId);
  const evidence = [...args.evidence].sort(byTimestampThenId);

  const events: InvestigationEvent[] = [];
  const emittedStages = new Set<string>();

  const pushStage = (stage: string, timestamp: string) => {
    if (emittedStages.has(stage)) return;
    emittedStages.add(stage);
    events.push({
      type: "STAGE_CHANGED",
      investigationId,
      stage,
      timestamp,
    });
  };

  // NORMALIZING is the entry stage of every started investigation; the row's
  // creation marks input normalization beginning.
  pushStage("NORMALIZING", createdAt);

  // Content extraction only exists for url/image/pdf inputs — and it
  // provably happened once claims exist (claims cannot exist without content).
  if (args.inputType !== "text" && claims.length > 0) {
    pushStage("EXTRACTING_CONTENT", claims[0].createdAt);
  }

  if (claims.length > 0) {
    pushStage("EXTRACTING_CLAIMS", claims[0].createdAt);
  }
  for (const claim of claims) {
    events.push({
      type: "CLAIM_CREATED",
      investigationId,
      claimId: claim.id,
      timestamp: claim.createdAt,
    });
  }

  if (searchQuery) {
    pushStage(
      "SEARCHING",
      sources.length > 0 ? sources[0].createdAt : updatedAt,
    );
  }

  if (sources.length > 0) {
    pushStage("READING_SOURCES", sources[0].createdAt);
  }
  for (const source of sources) {
    events.push({
      type: "SOURCE_DISCOVERED",
      investigationId,
      sourceId: source.id,
      timestamp: source.createdAt,
    });
  }

  if (evidence.length > 0) {
    pushStage("ANALYZING_EVIDENCE", evidence[0].createdAt);
  }
  for (const item of evidence) {
    events.push({
      type: "EVIDENCE_FOUND",
      investigationId,
      claimId: item.claimId,
      sourceId: item.sourceId,
      timestamp: item.createdAt,
    });
  }

  if (verdict) {
    pushStage("CALCULATING_TRUST", updatedAt);
  }

  if (status === "complete") {
    pushStage("COMPLETE", updatedAt);
    events.push({
      type: "INVESTIGATION_COMPLETED",
      investigationId,
      stage: "COMPLETE",
      timestamp: updatedAt,
    });
  } else if (status === "failed") {
    events.push({
      type: "INVESTIGATION_FAILED",
      investigationId,
      stage: currentStage,
      timestamp: updatedAt,
      ...(errorMessage ? { reason: errorMessage } : {}),
    });
  } else if (status === "processing") {
    // Live in-flight stage — persisted by the executor as it advances. This
    // is the authoritative current position, not an approximation.
    pushStage(currentStage, updatedAt);
  }

  return events;
}

function byTimestampThenId(
  a: { id: string; createdAt: string },
  b: { id: string; createdAt: string },
): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
