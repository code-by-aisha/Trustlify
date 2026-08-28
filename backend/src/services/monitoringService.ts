/**
 * Trustlify Backend — Monitoring Service (Placeholder)
 *
 * Phase 7: Will implement scheduled re-checks and change detection.
 * Phase 1: Interface only.
 */

import type { MonitoringItem } from "../types/investigation.js";

/**
 * Start monitoring a completed investigation.
 */
export async function startMonitoring(
  _investigationId: string,
  _userId: string,
): Promise<MonitoringItem> {
  // TODO Phase 7: Persist monitoring item to Supabase
  throw new Error("monitoringService.startMonitoring: NOT_IMPLEMENTED — Phase 7");
}

/**
 * Get all active monitoring items for a user.
 */
export async function getMonitoringItems(
  _userId: string,
): Promise<MonitoringItem[]> {
  // TODO Phase 7: Read from Supabase
  throw new Error("monitoringService.getMonitoringItems: NOT_IMPLEMENTED — Phase 7");
}
