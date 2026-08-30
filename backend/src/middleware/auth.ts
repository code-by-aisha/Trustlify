/**
 * Trustlify Backend — Authentication Middleware
 *
 * Phase 2: Real Supabase JWT validation.
 *
 * Architecture:
 *   1. Extract Authorization: Bearer <JWT> header
 *   2. Validate the Supabase JWT via supabase.auth.getUser()
 *   3. Extract user ID from the validated token
 *   4. Look up user role from profiles table
 *   5. Attach authenticated user to the request
 *   6. Reject missing or invalid authentication
 */

import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler.js";
import type { AuthenticatedUser, UserRole } from "../types/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

/**
 * authenticateUser — middleware that requires a valid authenticated session.
 *
 * Validates Supabase JWT and populates req.user.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(
      new AppError(401, "UNAUTHORIZED", "Missing or invalid Authorization header"),
    );
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      next(
        new AppError(
          401,
          "UNAUTHORIZED",
          error?.message ?? "Invalid or expired session",
        ),
      );
      return;
    }

    // Look up the user's role from the profiles table
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("auth_user_id", data.user.id)
      .single();

    const role: UserRole = (profile?.role as UserRole) ?? "general";

    req.user = {
      userId: data.user.id,
      role,
      email: data.user.email ?? "",
    };

    next();
  } catch (err) {
    next(
      new AppError(401, "UNAUTHORIZED", "Token validation failed"),
    );
  }
}

/**
 * optionalAuth — middleware that attaches user info if a valid token is present,
 * but does not reject the request if no token is provided.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && data.user) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("auth_user_id", data.user.id)
        .single();

      req.user = {
        userId: data.user.id,
        role: (profile?.role as UserRole) ?? "general",
        email: data.user.email ?? "",
      };
    }
  } catch {
    // Silently ignore — optional auth
  }

  next();
}

/**
 * requireOwnership — factory that returns middleware checking whether
 * the authenticated user owns the specified resource.
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
