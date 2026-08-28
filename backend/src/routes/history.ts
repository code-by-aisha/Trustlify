/**
 * Trustlify Backend — History Routes
 *
 * GET /api/history — List investigations for the authenticated user
 *
 * Phase 1: Returns unimplemented error (requires Supabase).
 */

import { Router } from "express";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import * as investigationService from "../services/investigationService.js";

export const historyRouter = Router();

historyRouter.get("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const investigations = await investigationService.listInvestigations(user.userId);
    res.json({
      success: true,
      data: investigations,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});
