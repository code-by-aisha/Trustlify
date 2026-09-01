/**
 * Trustlify Backend — CORS Strict Allowlist Tests
 *
 * Guards the transport behaviour behind the "Failed to fetch" profile bug:
 * a browser at http://127.0.0.1:5173 is a different origin from
 * http://localhost:5173, and the Vite dev server answers on both. When only one
 * was allowlisted the browser silently blocked every /api call — while Supabase
 * Auth (a different host) kept working, which made it look like a profile bug.
 *
 * The fix must stay strict: explicit origins only, never a wildcard.
 */

import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import type { Express } from "express";

let app: Express;
let request: ReturnType<typeof supertest>;
let parsedOrigins: unknown;

beforeAll(async () => {
  // Set before config/env.js is first evaluated so the test is self-contained
  // and proves the comma-separated allowlist parsing.
  process.env.FRONTEND_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173";
  const { createApp } = await import("../server.js");
  const { env } = await import("../config/env.js");
  app = createApp();
  request = supertest(app);
  parsedOrigins = env.FRONTEND_ORIGIN;
});

describe("FRONTEND_ORIGIN parsing", () => {
  it("reads a comma-separated strict allowlist", () => {
    expect(parsedOrigins).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
  });
});

describe("CORS allowlist on /api/profile", () => {
  it("allows the configured localhost dev origin", async () => {
    const res = await request.get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("allows the 127.0.0.1 loopback alias of the same dev server", async () => {
    const res = await request.get("/api/health").set("Origin", "http://127.0.0.1:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  });

  it("never emits a wildcard", async () => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
      const res = await request.get("/api/health").set("Origin", origin);
      expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    }
  });

  it("rejects an origin that is not on the allowlist", async () => {
    const res = await request.get("/api/health").set("Origin", "http://evil.example.com");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the authenticated PATCH preflight from either dev origin", async () => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
      const res = await request
        .options("/api/profile")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "PATCH")
        .set("Access-Control-Request-Headers", "content-type,authorization");
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
      expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    }
  });
});
