/**
 * Trustlify Backend — Upload Routes
 *
 * POST /api/uploads — Upload metadata validation
 *
 * Phase 1: Validates metadata only. No permanent storage.
 * Phase 2: Supabase Storage integration.
 */

import { Router } from "express";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import { uploadRateLimiter } from "../middleware/rateLimit.js";
import { uploadMetadataSchema } from "../validators/upload.js";
import * as uploadService from "../services/uploadService.js";

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  authenticateUser,
  uploadRateLimiter,
  async (req, res, next) => {
    try {
      const user = requireAuthenticatedUser(req);
      const metadata = uploadMetadataSchema.parse(req.body);
      const result = await uploadService.registerUpload(user.userId, metadata);
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
