/**
 * Trustlify Backend — Upload Routes
 *
 * POST /api/uploads — Upload a file (multipart/form-data)
 * POST /api/uploads/metadata — Validate and register upload metadata only
 */

import { Router } from "express";
import multer from "multer";
import { authenticateUser, requireAuthenticatedUser } from "../middleware/auth.js";
import { uploadRateLimiter } from "../middleware/rateLimit.js";
import { uploadMetadataSchema } from "../validators/upload.js";
import * as uploadService from "../services/uploadService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

export const uploadsRouter = Router();

// POST /api/uploads — Multipart file upload
uploadsRouter.post(
  "/",
  authenticateUser,
  uploadRateLimiter,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const user = requireAuthenticatedUser(req);
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: "NO_FILE", message: "No file provided" },
          requestId: req.requestId,
        });
        return;
      }

      const result = await uploadService.registerUpload(user.userId, {
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        fileBuffer: file.buffer,
        investigationId: req.body.investigationId || undefined,
      });

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

// POST /api/uploads/metadata — Metadata-only registration (no file body)
uploadsRouter.post(
  "/metadata",
  authenticateUser,
  uploadRateLimiter,
  async (req, res, next) => {
    try {
      const user = requireAuthenticatedUser(req);
      const metadata = uploadMetadataSchema.parse(req.body);
      const result = await uploadService.registerUpload(user.userId, {
        filename: metadata.filename,
        contentType: metadata.contentType,
        size: metadata.size,
      });
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
