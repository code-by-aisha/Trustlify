/**
 * Trustlify Backend — Profile Routes
 *
 * POST /api/profile — Create or update student profile
 * GET  /api/profile — Get current user's profile
 *
 * Phase 1: Returns NOT_IMPLEMENTED (requires Supabase in Phase 2).
 */

import { Router } from "express";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import { createProfileSchema } from "../validators/profile.js";
import * as profileService from "../services/profileService.js";

export const profileRouter = Router();

profileRouter.post("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const input = createProfileSchema.parse(req.body);
    const profile = await profileService.createProfile(user.userId, input);
    res.status(201).json({ success: true, data: profile, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

profileRouter.get("/", authenticateUser, async (req, res, next) => {
  try {
    const user = requireAuthenticatedUser(req);
    const profile = await profileService.getProfile(user.userId);
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Profile not found" },
        requestId: req.requestId,
      });
      return;
    }
    res.json({ success: true, data: profile, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});
