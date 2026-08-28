/**
 * Trustlify Backend — Monitoring Routes
 *
 * GET /api/monitoring — List active monitoring items
 *
 * Phase 1: Returns unimplemented error (requires Supabase + Phase 7).
 */

import { Router } from "express";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import * as monitoringService from "../services/monitoringService.js";

export const monitoringRouter = Router();

monitoringRouter.get("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const items = await monitoringService.getMonitoringItems(user.userId);
    res.json({
      success: true,
      data: items,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});
