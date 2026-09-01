/**
 * Trustlify Backend — Investigation Routes
 *
 * POST /api/investigations           — Create investigation
 * POST /api/investigations/:id/start — Start the pipeline
 * GET  /api/investigations/:id       — Get investigation state
 * POST /api/investigations/:id/recheck — Re-check investigation
 * POST /api/investigations/:id/monitor — Start monitoring
 */

import { Router } from "express";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import { investigationRateLimiter } from "../middleware/rateLimit.js";
import { createInvestigationSchema } from "../validators/investigation.js";
import { idParamSchema } from "../validators/common.js";
import * as investigationService from "../services/investigationService.js";
import * as monitoringService from "../services/monitoringService.js";

export const investigationsRouter = Router();

// POST /api/investigations — Create a new investigation
investigationsRouter.post(
  "/",
  authenticateUser,
  investigationRateLimiter,
  async (req, res, next) => {
    try {
      const user = requireAuthenticatedUser(req);
      const input = createInvestigationSchema.parse(req.body);
      const result = await investigationService.createInvestigation(user.userId, input);
      res.status(201).json({
        success: true,
        data: result,
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/investigations/:id/start — Start the investigation pipeline
investigationsRouter.post("/:id/start", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await investigationService.startInvestigation(id, user.userId);
    res.status(202).json({
      success: true,
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/investigations/:id — Get investigation state
investigationsRouter.get("/:id", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { id } = idParamSchema.parse(req.params);
    // The authenticated role decides whether the student-profile comparison is
    // read at all — the ownership check inside the service is unchanged.
    const investigation = await investigationService.getInvestigation(id, user.userId, {
      role: user.role,
    });
    res.json({
      success: true,
      data: investigation,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/investigations/:id/recheck — Re-check investigation
investigationsRouter.post("/:id/recheck", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { id } = idParamSchema.parse(req.params);
    const result = await investigationService.recheckInvestigation(id, user.userId);
    res.status(202).json({
      success: true,
      data: result,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/investigations/:id/monitor — Start monitoring
investigationsRouter.post("/:id/monitor", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { id } = idParamSchema.parse(req.params);
    const item = await monitoringService.startMonitoring(id, user.userId);
    res.status(201).json({
      success: true,
      data: item,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});
