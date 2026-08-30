/**
 * Trustlify Backend — Investigation Event Model
 *
 * Phase 3C: small internal event representation produced by the mini
 * investigation pipeline. Events are generated ONLY for real occurrences
 * (a claim persisted, a source discovered, a stage transition observed).
 *
 * These events later support: live graph, activity timeline, investigation
 * progress, and audit trail. Phase 3C derives them from persisted rows, so
 * they survive page refreshes without a new storage system.
 *
 * WebSockets are intentionally NOT used — polling is acceptable this phase.
 */

export type InvestigationEventType =
  | "STAGE_CHANGED"
  | "CLAIM_CREATED"
  | "SOURCE_DISCOVERED"
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

/**
 * Derive the event stream from persisted investigation rows.
 * Deterministic: rows are ordered by timestamp then id, and events are emitted
 * in chronological stage order (stage entry first, then its child events).
 *
 * Stage-change events are synthesized ONLY for stages that provably happened:
 *   CLAIMS  — proven by the existence of claim rows
 *   SEARCH  — proven by a persisted search_query (the stage was entered;
 *             timestamp approximated by the earliest source when present,
 *             otherwise the row's last update)
 *   SOURCES — proven by the existence of source rows
 * No stage is reported without evidence of it in the data.
 */
export function deriveInvestigationEvents(args: {
  investigationId: string;
  claims: EventClaimRow[];
  sources: EventSourceRow[];
  createdAt: string;
  status: string;
  currentStage: string;
  updatedAt: string;
  /** Persisted search query — proves the SEARCH stage was entered. */
  searchQuery?: string | null;
  /** The claim the targeted search was built from, when persisted. */
  selectedClaimId?: string | null;
}): InvestigationEvent[] {
  const {
    investigationId,
    createdAt,
    status,
    currentStage,
    updatedAt,
    searchQuery = null,
    selectedClaimId = null,
  } = args;

  const claims = [...args.claims].sort(byTimestampThenId);
  const sources = [...args.sources].sort(byTimestampThenId);

  const events: InvestigationEvent[] = [];

  // NORMALIZING is the entry stage of every started investigation; the row's
  // creation marks input normalization beginning.
  events.push({
    type: "STAGE_CHANGED",
    investigationId,
    stage: "NORMALIZING",
    timestamp: createdAt,
  });

  if (claims.length > 0) {
    events.push({
      type: "STAGE_CHANGED",
      investigationId,
      stage: "CLAIMS",
      timestamp: claims[0].createdAt,
    });
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
    events.push({
      type: "STAGE_CHANGED",
      investigationId,
      stage: "SEARCH",
      timestamp: sources.length > 0 ? sources[0].createdAt : updatedAt,
    });
  }

  if (sources.length > 0) {
    events.push({
      type: "STAGE_CHANGED",
      investigationId,
      stage: "SOURCES",
      timestamp: sources[0].createdAt,
    });
  }
  for (const source of sources) {
    events.push({
      type: "SOURCE_DISCOVERED",
      investigationId,
      sourceId: source.id,
      // The selected claim is the claim the targeted search was built from —
      // sources were discovered in service of investigating it.
      ...(selectedClaimId ? { claimId: selectedClaimId } : {}),
      timestamp: source.createdAt,
    });
  }

  if (status === "complete") {
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
    });
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
