/**
 * Trustlify Backend — Rate Limit Middleware
 *
 * Basic rate limiting using express-rate-limit.
 * Provides sensible defaults to protect against abuse.
 */

import rateLimit from "express-rate-limit";

/**
 * General API rate limiter — 100 requests per 15-minute window per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  },
});

/**
 * Stricter rate limiter for investigation creation — 20 requests per 15-minute window.
 */
export const investigationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many investigation requests. Please try again later.",
    },
  },
});

/**
 * Upload rate limiter — 10 uploads per 15-minute window.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many upload requests. Please try again later.",
    },
  },
});
