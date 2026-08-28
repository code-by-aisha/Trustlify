/**
 * Trustlify Backend — Investigation Service
 *
 * Phase 1: Provides the service interface and uses InMemoryJobStore for state.
 * Phase 4: Will wire up the full AI investigation pipeline.
 */

import { v4 as uuidv4 } from "uuid";
import type { Investigation, InputType } from "../types/investigation.js";
import { InMemoryJobStore, type JobStore } from "../investigation/pipeline.js";
import type { CreateInvestigationInput } from "../validators/investigation.js";
import { AppError } from "../middleware/errorHandler.js";

const jobStore: JobStore = new InMemoryJobStore();

/**
 * Create a new investigation.
 * Returns the investigation ID for async polling.
 */
export async function createInvestigation(
  userId: string,
  input: CreateInvestigationInput,
): Promise<{ id: string; status: string }> {
  const now = new Date().toISOString();
  const investigation: Investigation = {
    id: uuidv4(),
    userId,
    inputType: input.inputType as InputType,
    inputText: input.inputText,
    inputFilePath: input.inputFilePath,
    status: "CREATED",
    claims: [],
    sources: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };

  await jobStore.set(investigation.id, investigation);
  return { id: investigation.id, status: investigation.status };
}

/**
 * Start the investigation pipeline for a given investigation.
 * Phase 4: Will kick off the async AI pipeline.
 */
export async function startInvestigation(
  id: string,
  userId: string,
): Promise<{ status: string }> {
  const investigation = await jobStore.get(id);
  if (!investigation) {
    throw new AppError(404, "NOT_FOUND", "Investigation not found");
  }
  if (investigation.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this investigation");
  }
  if (investigation.status !== "CREATED") {
    throw new AppError(400, "INVALID_STATE", `Investigation is already in status: ${investigation.status}`);
  }

  // Phase 4: Kick off async pipeline here
  await jobStore.updateStatus(id, "NORMALIZING");
  return { status: "NORMALIZING" };
}

/**
 * Get the current state of an investigation.
 */
export async function getInvestigation(
  id: string,
  userId: string,
): Promise<Investigation> {
  const investigation = await jobStore.get(id);
  if (!investigation) {
    throw new AppError(404, "NOT_FOUND", "Investigation not found");
  }
  if (investigation.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this investigation");
  }
  return investigation;
}

/**
 * Re-check a completed investigation.
 * Phase 4: Will re-run the pipeline with fresh data.
 */
export async function recheckInvestigation(
  id: string,
  userId: string,
): Promise<{ status: string }> {
  const investigation = await jobStore.get(id);
  if (!investigation) {
    throw new AppError(404, "NOT_FOUND", "Investigation not found");
  }
  if (investigation.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this investigation");
  }

  // Phase 4: Reset and re-run the pipeline
  await jobStore.updateStatus(id, "CREATED");
  return { status: "CREATED" };
}

/**
 * List investigations for a user (used by history route).
 */
export async function listInvestigations(
  userId: string,
): Promise<Investigation[]> {
  return jobStore.listByUser(userId);
}
