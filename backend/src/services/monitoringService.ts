/**
 * Trustlify Backend — Monitoring Service
 *
 * Phase 2: Supabase-backed monitoring items.
 * Automatic scheduled monitoring is NOT implemented yet (Phase 7).
 */

import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../middleware/errorHandler.js";

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
 * Get all monitoring items for a user.
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

  return (data ?? []).map(mapMonitoringRow);
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
