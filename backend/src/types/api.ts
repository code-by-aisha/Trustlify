/**
 * Trustlify Backend — API Types
 *
 * Shared types for API requests and responses.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  requestId?: string;
}

export interface HealthCheckResponse {
  status: "ok";
  service: "trustlify-backend";
  timestamp: string;
  uptime: number;
}
