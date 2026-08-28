/**
 * Trustlify Backend — Error Handler Middleware
 *
 * Centralized error handling:
 * - Normalizes all errors into a consistent API error response
 * - Hides stack traces in production
 * - Never leaks internal implementation details
 * - Logs errors with request context
 */

import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Application error with an HTTP status code and error code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;

  // JSON parse errors from body-parser
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
      requestId,
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      requestId,
    });
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error("Server error", {
        requestId,
        code: err.code,
        message: err.message,
      });
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
      requestId,
    });
    return;
  }

  // Unexpected errors — never expose stack traces in production
  logger.error("Unhandled error", {
    requestId,
    message: err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction
        ? "An unexpected error occurred"
        : err.message,
    },
    requestId,
  });
}
