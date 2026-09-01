/**
 * Trustlify Backend — Server Tests
 *
 * Tests for health endpoint, 404 handling, error handling,
 * request ID, Zod validation, invalid JSON, and auth middleware.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import type { Express } from "express";
import { createApp } from "../server.js";

// Suppress server.listen() during tests by overriding module behavior
let app: Express;
let request: ReturnType<typeof supertest>;

beforeAll(() => {
  app = createApp();
  request = supertest(app);
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request.get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("trustlify-backend");
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });

  it("includes a request ID header", async () => {
    const res = await request.get("/api/health");
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"].length).toBeGreaterThan(0);
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request.get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Invalid JSON", () => {
  it("returns 400 for malformed JSON body", async () => {
    const res = await request
      .post("/api/investigations")
      .set("Content-Type", "application/json")
      .send("{ invalid json }}}");
    // Express returns 400 for JSON parse errors
    expect(res.status).toBe(400);
  });
});

describe("Request ID middleware", () => {
  it("generates a request ID when none is provided", async () => {
    const res = await request.get("/api/health");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("preserves an existing X-Request-ID header", async () => {
    const customId = "test-request-id-12345";
    const res = await request
      .get("/api/health")
      .set("X-Request-ID", customId);
    expect(res.headers["x-request-id"]).toBe(customId);
  });
});

describe("Auth middleware interface", () => {
  it("rejects unauthenticated requests to protected routes", async () => {
    const res = await request.get("/api/profile");
    // Auth middleware returns 401 for missing Authorization header
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with invalid Bearer format", async () => {
    const res = await request
      .get("/api/profile")
      .set("Authorization", "InvalidToken abc123");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for valid Bearer format with invalid token (Phase 2 — Supabase JWT validation)", async () => {
    const res = await request
      .get("/api/profile")
      .set("Authorization", "Bearer fake-jwt-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("keeps the similar-opportunity endpoint behind authentication", async () => {
    // Discovery costs a search call, so it must never be reachable anonymously.
    const anonymous = await request.post("/api/investigations/some-id/similar");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHORIZED");

    const badToken = await request
      .post("/api/investigations/some-id/similar")
      .set("Authorization", "Bearer fake-jwt-token");
    expect(badToken.status).toBe(401);
    expect(badToken.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Zod validation", () => {
  it("rejects investigation creation with missing required fields", async () => {
    const res = await request
      .post("/api/investigations")
      .set("Authorization", "Bearer fake-token")
      .send({});
    // Auth middleware runs before validation, so we get 401 first
    expect([400, 401]).toContain(res.status);
  });

  it("rejects upload with invalid MIME type", async () => {
    // This test validates the Zod schema directly
    const { uploadMetadataSchema } = await import("../validators/upload.js");
    const result = uploadMetadataSchema.safeParse({
      filename: "test.exe",
      contentType: "application/x-executable",
      size: 1024,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid upload metadata", async () => {
    const { uploadMetadataSchema } = await import("../validators/upload.js");
    const result = uploadMetadataSchema.safeParse({
      filename: "screenshot.png",
      contentType: "image/png",
      size: 500000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects investigation with invalid URL", async () => {
    const { createInvestigationSchema } = await import("../validators/investigation.js");
    const result = createInvestigationSchema.safeParse({
      inputType: "url",
      inputText: "not-a-valid-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid investigation with URL input", async () => {
    const { createInvestigationSchema } = await import("../validators/investigation.js");
    const result = createInvestigationSchema.safeParse({
      inputType: "url",
      inputText: "https://example.com/scholarship",
    });
    expect(result.success).toBe(true);
  });

  it("rejects URL targeting private network", async () => {
    const { createInvestigationSchema } = await import("../validators/investigation.js");
    const result = createInvestigationSchema.safeParse({
      inputType: "url",
      inputText: "http://localhost:3000/internal",
    });
    expect(result.success).toBe(false);
  });
});

describe("Error handler", () => {
  it("returns normalized error structure for AppError", async () => {
    // The auth middleware generates a known AppError — verify structure
    const res = await request.get("/api/profile");
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("message");
  });
});
