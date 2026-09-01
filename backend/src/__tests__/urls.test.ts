/**
 * Trustlify Backend — URL Safety Unit Tests
 *
 * Pure deterministic checks on the IPv4 private/internal detection that gates
 * every server-side URL fetch. No network access (spec 42).
 *
 * Covers the RFC 6598 CGNAT range (100.64.0.0/10), which is not RFC 1918 but
 * is not publicly routable either — it fronts internal services on tailnets
 * and container network CIDRs, so it must never be fetched server-side.
 */

import { describe, it, expect } from "vitest";
import { isPrivateIpv4 } from "../utils/urls.js";

describe("isPrivateIpv4 — RFC 6598 CGNAT (100.64.0.0/10)", () => {
  it("rejects an address at the start of the CGNAT range", () => {
    expect(isPrivateIpv4("100.64.0.1")).toBe(true);
  });

  it("rejects an address at the end of the CGNAT range", () => {
    expect(isPrivateIpv4("100.127.255.254")).toBe(true);
  });

  it("still allows a normal public IPv4 address", () => {
    expect(isPrivateIpv4("93.184.216.34")).toBe(false);
  });
});
