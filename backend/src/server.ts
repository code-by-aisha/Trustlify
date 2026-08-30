/**
 * Trustlify Backend — Server Entry Point
 *
 * Wires up Express with all middleware, routes, and graceful shutdown.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { healthRouter } from "./routes/health.js";
import { profileRouter } from "./routes/profile.js";
import { investigationsRouter } from "./routes/investigations.js";
import { uploadsRouter } from "./routes/uploads.js";
import { historyRouter } from "./routes/history.js";
import { monitoringRouter } from "./routes/monitoring.js";

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — strict origin from environment
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    }),
  );

  // Body parsing with size limits
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // Request ID for tracing
  app.use(requestIdMiddleware);

  // Global rate limiter
  app.use("/api", apiRateLimiter);

  // --- Routes ---

  // Health check (no auth required)
  app.use("/api/health", healthRouter);

  // Protected API routes
  app.use("/api/profile", profileRouter);
  app.use("/api/investigations", investigationsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/monitoring", monitoringRouter);

  // 404 handler for unknown routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exist",
      },
    });
  });

  // Centralized error handler (must be registered last)
  app.use(errorHandler);

  return app;
}

// --- Server startup ---

// Only start listening when this file is the main entry point (not during tests).
// Handles both POSIX and Windows path separators in process.argv[1].
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/server.ts") ||
    process.argv[1].endsWith("\\server.ts") ||
    process.argv[1].endsWith("/server.js") ||
    process.argv[1].endsWith("\\server.js"));

if (isMainModule) {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Trustlify backend listening on port ${env.PORT}`, {
      nodeEnv: env.NODE_ENV,
      frontendOrigin: env.FRONTEND_ORIGIN,
    });
  });

  // --- Graceful shutdown ---

  function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
