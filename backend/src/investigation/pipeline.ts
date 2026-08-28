/**
 * Trustlify Backend — Investigation Pipeline
 *
 * Phase 4: Will orchestrate the full investigation lifecycle.
 * Phase 1: Interface and job state abstraction only.
 *
 * Lifecycle:
 *   CREATED → NORMALIZING → CLAIMS → SEARCH → EVIDENCE →
 *   INVESTIGATING → VERIFYING → MATCHING → DECIDING → COMPLETE
 */

import type { Investigation, InvestigationStatus } from "../types/investigation.js";

/**
 * JobStore — abstraction for tracking async investigation jobs.
 *
 * Future implementation:
 *   - Development: in-memory Map
 *   - Production: Redis if scaling requires it
 *
 * Do NOT install Redis in Phase 1.
 */
export interface JobStore {
  get(id: string): Promise<Investigation | null>;
  set(id: string, investigation: Investigation): Promise<void>;
  updateStatus(id: string, status: InvestigationStatus): Promise<void>;
  delete(id: string): Promise<void>;
  listByUser(userId: string): Promise<Investigation[]>;
}

/**
 * In-memory job store for development and hackathon MVP.
 */
export class InMemoryJobStore implements JobStore {
  private store = new Map<string, Investigation>();

  async get(id: string): Promise<Investigation | null> {
    return this.store.get(id) ?? null;
  }

  async set(id: string, investigation: Investigation): Promise<void> {
    this.store.set(id, investigation);
  }

  async updateStatus(id: string, status: InvestigationStatus): Promise<void> {
    const existing = this.store.get(id);
    if (existing) {
      existing.status = status;
      existing.updatedAt = new Date().toISOString();
    }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async listByUser(userId: string): Promise<Investigation[]> {
    return Array.from(this.store.values()).filter(
      (inv) => inv.userId === userId,
    );
  }
}
