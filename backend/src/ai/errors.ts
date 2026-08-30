/**
 * Trustlify Backend — AI Layer Errors
 *
 * Standardized error type for all AI provider implementations.
 * Messages must be safe to surface: never contain API keys or raw credentials.
 */

export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_MODEL"
  | "AI_MALFORMED_OUTPUT"
  | "AI_REQUEST_FAILED";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}
