/**
 * Trustlify Backend — Search Layer Errors
 *
 * Standardized error type for all search provider implementations.
 * Messages must be safe to surface: never contain API keys or raw credentials.
 */

export type SearchErrorCode =
  | "SEARCH_NOT_CONFIGURED"
  | "SEARCH_AUTH_FAILED"
  | "SEARCH_RATE_LIMITED"
  | "SEARCH_REQUEST_FAILED"
  | "SEARCH_PROVIDER_FAILED"
  | "SEARCH_NETWORK_FAILED"
  | "SEARCH_MALFORMED_RESPONSE";

export class SearchError extends Error {
  constructor(
    public readonly code: SearchErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SearchError";
  }
}
