/**
 * Trustlify Backend — Model Studio Provider (Placeholder)
 *
 * Phase 3: Will implement AIProvider using Alibaba Cloud Model Studio / Qwen.
 * Phase 1: All methods throw NOT_IMPLEMENTED.
 *
 * Environment variables (Phase 3):
 *   DASHSCOPE_API_KEY
 *   MODEL_STUDIO_BASE_URL
 *   MODEL_STUDIO_PRIMARY_MODEL
 *   MODEL_STUDIO_FAST_MODEL
 */

import type {
  AIProvider,
  ExtractClaimsInput,
  ExtractClaimsOutput,
  PlanSearchInput,
  PlanSearchOutput,
  AnalyzeEvidenceInput,
  AnalyzeEvidenceOutput,
  VerifyClaimsInput,
  VerifyClaimsOutput,
  AnalyzeImageInput,
  AnalyzeImageOutput,
  MatchStudentInput,
  ExplainDecisionInput,
  LocalizeInput,
} from "./AIProvider.js";
import type { StudentMatch } from "../types/investigation.js";

export class ModelStudioProvider implements AIProvider {
  // TODO Phase 3: Initialize Model Studio SDK client here
  // private client: ModelStudioClient;

  constructor() {
    // TODO Phase 3: Read env vars and configure client
    // this.client = new ModelStudioClient({
    //   apiKey: env.DASHSCOPE_API_KEY,
    //   baseUrl: env.MODEL_STUDIO_BASE_URL,
    // });
  }

  async extractClaims(_input: ExtractClaimsInput): Promise<ExtractClaimsOutput> {
    throw new Error("ModelStudioProvider.extractClaims: NOT_IMPLEMENTED — Phase 3");
  }

  async planSearch(_input: PlanSearchInput): Promise<PlanSearchOutput> {
    throw new Error("ModelStudioProvider.planSearch: NOT_IMPLEMENTED — Phase 3");
  }

  async analyzeEvidence(_input: AnalyzeEvidenceInput): Promise<AnalyzeEvidenceOutput> {
    throw new Error("ModelStudioProvider.analyzeEvidence: NOT_IMPLEMENTED — Phase 3");
  }

  async verifyClaims(_input: VerifyClaimsInput): Promise<VerifyClaimsOutput> {
    throw new Error("ModelStudioProvider.verifyClaims: NOT_IMPLEMENTED — Phase 3");
  }

  async analyzeImage(_input: AnalyzeImageInput): Promise<AnalyzeImageOutput> {
    throw new Error("ModelStudioProvider.analyzeImage: NOT_IMPLEMENTED — Phase 3");
  }

  async matchStudent(_input: MatchStudentInput): Promise<StudentMatch> {
    throw new Error("ModelStudioProvider.matchStudent: NOT_IMPLEMENTED — Phase 3");
  }

  async explainDecision(_input: ExplainDecisionInput): Promise<string> {
    throw new Error("ModelStudioProvider.explainDecision: NOT_IMPLEMENTED — Phase 3");
  }

  async localize(_input: LocalizeInput): Promise<string> {
    throw new Error("ModelStudioProvider.localize: NOT_IMPLEMENTED — Phase 3");
  }
}
