/**
 * Trustlify Backend — Auth Types
 *
 * Types for authentication and authorization.
 * Phase 1: Interface only. Supabase Auth integration in Phase 2.
 */

export interface AuthenticatedUser {
  /** The user ID derived from the validated session (never trust client-supplied IDs) */
  userId: string;
  /** User role — determines access level */
  role: UserRole;
  /** Email from the validated session */
  email: string;
}

export type UserRole = "student" | "general";

/**
 * Express Request augmentation for authenticated requests.
 */
declare global {
  namespace Express {
    interface Request {
      /** Populated by authenticateUser middleware after successful JWT validation */
      user?: AuthenticatedUser;
      /** Request ID set by requestId middleware */
      requestId?: string;
    }
  }
}

/**
 * Future Supabase JWT payload structure.
 * Not used in Phase 1 — placeholder for Phase 2 integration.
 */
export interface SupabaseJWTPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}
