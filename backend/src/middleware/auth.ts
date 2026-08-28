/**
 * Trustlify Backend — Authentication Middleware
 *
 * Phase 1: Structural interface for authentication.
 * Phase 2: Supabase JWT validation will be wired here.
 *
 * Architecture:
 *   1. Extract Authorization: Bearer <JWT> header
 *   2. Validate the Supabase JWT
 *   3. Extract user ID from the validated token
 *   4. Attach authenticated user to the request
 *   5. Reject missing or invalid authentication
 *
 * IMPORTANT:
 *   - Do NOT implement custom passwords
 *   - Do NOT create custom session systems
 *   - Supabase Auth is the identity provider
 *   - Never trust a user_id supplied by the frontend
 */

import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";
import type { AuthenticatedUser } from "../types/auth.js";

/**
 * authenticateUser — middleware that requires a valid authenticated session.
 *
 * Phase 1: Always returns 501 NOT_IMPLEMENTED since Supabase Auth is not connected yet.
 * Phase 2: Will validate Supabase JWT and populate req.user.
 */
export function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  // Structural check — verify the header format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(
      new AppError(401, "UNAUTHORIZED", "Missing or invalid Authorization header"),
    );
    return;
  }

  // Phase 1: Supabase Auth not yet connected — reject with a clear message
  // Phase 2: Replace this block with Supabase JWT validation
  //   const token = authHeader.slice(7);
  //   const { data, error } = await supabase.auth.getUser(token);
  //   if (error || !data.user) { next(new AppError(401, ...)); return; }
  //   req.user = { userId: data.user.id, role: ..., email: ... };
  //   next();

  next(
    new AppError(
      501,
      "AUTH_NOT_IMPLEMENTED",
      "Authentication is not yet connected. Supabase Auth will be integrated in Phase 2.",
    ),
  );
}

/**
 * optionalAuth — middleware that attaches user info if a valid token is present,
 * but does not reject the request if no token is provided.
 *
 * Phase 1: Always passes through without attaching a user.
 */
export function optionalAuth(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Phase 2: Attempt token validation, but call next() regardless
  next();
}

/**
 * requireOwnership — factory that returns middleware checking whether
 * the authenticated user owns the specified resource.
 *
 * The resource owner ID should come from the database, not the request body.
 */
export function requireOwnership(
  getResourceOwnerId: (req: Request) => Promise<string | null>,
) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    try {
      const ownerId = await getResourceOwnerId(req);
      if (ownerId === null) {
        next(new AppError(404, "NOT_FOUND", "Resource not found"));
        return;
      }
      if (ownerId !== req.user.userId) {
        next(
          new AppError(
            403,
            "FORBIDDEN",
            "You do not have permission to access this resource",
          ),
        );
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper to get the authenticated user from a request,
 * throwing if not authenticated.
 */
export function requireAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }
  return req.user;
}
