/**
 * Trustlify Backend — History Routes
 *
 * GET /api/history — List investigations for the authenticated user (paginated)
 */

import { Router } from "express";
import { z } from "zod";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import * as investigationService from "../services/investigationService.js";

export const historyRouter = Router();

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

historyRouter.get("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const { limit, offset } = paginationSchema.parse(req.query);
    const result = await investigationService.listInvestigations(user.userId, { limit, offset });
    res.json({
      success: true,
      data: result.investigations,
      meta: { total: result.total, limit, offset },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
});
