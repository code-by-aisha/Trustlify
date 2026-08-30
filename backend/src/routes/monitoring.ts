/**
 * Trustlify Backend — Monitoring Routes
 *
 * GET    /api/monitoring       — List active monitoring items
 * POST   /api/monitoring       — Start monitoring an investigation
 * PATCH  /api/monitoring/:id   — Toggle monitoring on/off
 */

import { Router } from "express";
import { z } from "zod";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import { idParamSchema } from "../validators/common.js";
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

const startMonitoringSchema = z.object({
  investigationId: z.string().uuid(),
});

monitoringRouter.post("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { investigationId } = startMonitoringSchema.parse(req.body);
    const item = await monitoringService.startMonitoring(investigationId, user.userId);
    res.status(201).json({
      success: true,
      data: item,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});

const toggleSchema = z.object({
  active: z.boolean(),
});

monitoringRouter.patch("/:id", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { id } = idParamSchema.parse(req.params);
    const { active } = toggleSchema.parse(req.body);
    const item = await monitoringService.toggleMonitoring(id, user.userId, active);
    res.json({
      success: true,
      data: item,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});
