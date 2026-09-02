/**
 * Trustlify Backend — Monitoring Service
 *
 * Phase 2: Supabase-backed monitoring items.
 * Automatic scheduled monitoring is NOT implemented yet (Phase 7).
 */

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  assessDeadline,
  type DeadlineClaimInput,
} from "../engines/currentnessEngine.js";

/**
 * One meaningful change observed on a monitored investigation.
 *
 * ⚠ WHAT THIS CAN HONESTLY COVER. This project has no background worker, no
 * scheduler and no re-fetch loop, and this module must not pretend otherwise:
 * it makes no network call to the opportunity's page, so it can never lawfully
 * report that a page's *content* changed. What it can report is a change that
 * the already-persisted evidence proves on its own — the recorded application
 * window closing while the item was being monitored. That is assessed with the
 * same deterministic deadline engine the result page uses, over the same stored
 * claims, at two different clocks. No snapshot, no guess, no invented event.
 */
export interface MonitoringChange {
  field: "deadline_state";
  /** The recorded window when monitoring started. */
  before: string;
  /** The same recorded window read at the current time. */
  after: string;
  detail: string;
}

/**
 * Start monitoring a completed investigation.
 */
export async function startMonitoring(
  investigationId: string,
  userId: string,
) {
  // Verify the investigation belongs to the user
  const { data: inv, error: invError } = await supabaseAdmin
    .from("investigations")
    .select("id, user_id")
    .eq("id", investigationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (invError || !inv) {
    throw new AppError(404, "NOT_FOUND", "Investigation not found");
  }

  // Check if already monitoring
  const { data: existing } = await supabaseAdmin
    .from("monitoring_items")
    .select("id")
    .eq("investigation_id", investigationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    // Re-activate if inactive
    const { data, error } = await supabaseAdmin
      .from("monitoring_items")
      .update({ active: true })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new AppError(500, "MONITORING_START_FAILED", "Failed to start monitoring");
    }

    return mapMonitoringRow(data);
  }

  // Create new monitoring item
  const { data, error } = await supabaseAdmin
    .from("monitoring_items")
    .insert({
      investigation_id: investigationId,
      user_id: userId,
      active: true,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(500, "MONITORING_START_FAILED", "Failed to start monitoring");
  }

  return mapMonitoringRow(data);
}

/**
 * Get all monitoring items for a user, each with the changes its own persisted
 * evidence now proves.
 */
export async function getMonitoringItems(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("monitoring_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(500, "MONITORING_LIST_FAILED", "Failed to list monitoring items");
  }

  const rows = (data ?? []) as MonitoringRow[];
  if (rows.length === 0) return [];

  const claims = await loadClaims(rows.map((row) => row.investigation_id));

  return rows.map((row) => ({
    ...mapMonitoringRow(row),
    changes: detectChanges(row, claims.get(row.investigation_id) ?? []),
  }));
}

/**
 * Every claim of the monitored investigations, grouped per investigation.
 * The deadline engine filters these itself (by claim type and by date
 * phrasing), so nothing is pre-narrowed here and the reading stays identical to
 * the one on the investigation's own result page.
 */
async function loadClaims(
  investigationIds: string[],
): Promise<Map<string, DeadlineClaimInput[]>> {
  const grouped = new Map<string, DeadlineClaimInput[]>();
  const unique = [...new Set(investigationIds.filter(Boolean))];
  if (unique.length === 0) return grouped;

  const { data, error } = await supabaseAdmin
    .from("claims")
    .select("id, investigation_id, claim_text, claim_type")
    .in("investigation_id", unique);

  // A missing column or an unreachable table must never break the list — an
  // item with no readable evidence simply reports no changes.
  if (error || !data) return grouped;

  for (const row of data as ClaimRow[]) {
    const list = grouped.get(row.investigation_id) ?? [];
    list.push({ id: row.id, text: row.claim_text ?? "", type: row.claim_type ?? "other" });
    grouped.set(row.investigation_id, list);
  }
  return grouped;
}

/**
 * The change a monitored item can prove from its own stored claims: the window
 * was open when monitoring started and is not open now.
 */
function detectChanges(
  row: MonitoringRow,
  claims: DeadlineClaimInput[],
): MonitoringChange[] {
  if (claims.length === 0) return [];

  const startedAt = new Date(row.created_at);
  if (Number.isNaN(startedAt.getTime())) return [];
  const now = new Date();
  // Monitoring started in the future (clock skew) — say nothing.
  if (startedAt.getTime() > now.getTime()) return [];

  const atStart = assessDeadline(claims, startedAt);
  const current = assessDeadline(claims, now);
  if (atStart.state === current.state) return [];

  return [
    {
      field: "deadline_state",
      before: atStart.state,
      after: current.state,
      detail: current.detail,
    },
  ];
}

/**
 * Toggle monitoring on/off for an item.
 */
export async function toggleMonitoring(
  id: string,
  userId: string,
  active: boolean,
) {
  const { data, error } = await supabaseAdmin
    .from("monitoring_items")
    .update({ active })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new AppError(500, "MONITORING_TOGGLE_FAILED", "Failed to toggle monitoring");
  }

  return mapMonitoringRow(data);
}

interface MonitoringRow {
  id: string;
  investigation_id: string;
  user_id: string;
  active: boolean;
  last_checked_at: string | null;
  created_at: string;
}

interface ClaimRow {
  id: string;
  investigation_id: string;
  claim_text: string;
  claim_type: string;
}

function mapMonitoringRow(row: MonitoringRow) {
  return {
    id: row.id,
    investigationId: row.investigation_id,
    userId: row.user_id,
    active: row.active,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
  };
}
