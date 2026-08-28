/**
 * Trustlify Backend — Request ID Middleware
 *
 * Assigns a unique request ID to every incoming request for tracing.
 * Uses the existing X-Request-ID header if present, otherwise generates one.
 */

import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existingId = req.headers["x-request-id"];
  const id =
    typeof existingId === "string" && existingId.length > 0
      ? existingId
      : uuidv4();

  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}
