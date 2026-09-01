/**
 * Trustlify Backend — URL Safety Utility (SSRF protection)
 *
 * Utilities for validating and parsing URLs submitted by users.
 *
 * Phase 4: hardened SSRF validation —
 *   - full RFC 1918 / reserved IPv4 ranges, loopback, link-local
 *   - IPv6 loopback / link-local / unique-local and v4-mapped addresses
 *   - private-suffix hostnames (.local, .internal)
 *   - DNS-resolution check (webExtractor resolves the hostname before
 *     fetching and re-validates every redirect hop)
 */

import { z } from "zod";

/**
 * Validates that a URL string is a well-formed HTTP or HTTPS URL.
 * Rejects non-HTTP schemes, malformed URLs, and empty strings.
 */
export function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parses a URL and returns structured hostname information.
 * Returns null if the URL is not valid HTTP(S).
 */
export function parseUrlInfo(raw: string): UrlInfo | null {
  if (!isValidHttpUrl(raw)) return null;

  const url = new URL(raw);
  return {
    href: url.href,
    protocol: url.protocol,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    origin: url.origin,
  };
}

export interface UrlInfo {
  href: string;
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  origin: string;
}

/**
 * Checks whether an IPv4 literal string sits in a private/reserved range.
 * Pure string-prefix logic — deterministic and testable.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 — "this network" (includes 0.0.0.0)
  if (a === 10) return true; // 10.0.0.0/8 — private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT (RFC 6598)
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 — reserved
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

/**
 * Checks whether an IPv6 literal (with or without brackets) is loopback,
 * link-local, unique-local, deprecated site-local, or v4-mapped private.
 */
export function isPrivateIpv6(ip: string): boolean {
  let value = ip.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  // Strip zone index (fe80::1%eth0)
  const zone = value.indexOf("%");
  if (zone >= 0) value = value.slice(0, zone);

  if (value === "::" || value === "::1") return true; // unspecified + loopback
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) {
    return true; // fe80::/10 — link-local
  }
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // fc00::/7 — unique-local
  if (value.startsWith("fec") || value.startsWith("fed") || value.startsWith("fee") || value.startsWith("fef")) {
    return true; // fec0::/10 — deprecated site-local
  }
  // IPv4-mapped (::ffff:10.0.0.1) and IPv4-compatible (::10.0.0.1) forms
  const v4Mapped = value.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIpv4(v4Mapped[1]);
  if (value.startsWith("64:ff9b:")) return false; // NAT64 — public translation, allow
  if (value.startsWith("100::")) return true; // discard-only prefix
  return false;
}

/** True when the string is any IP literal (v4 or v6). */
export function isIpLiteral(host: string): boolean {
  const bare = host.replace(/^\[/, "").replace(/\]$/, "");
  return /^\d+\.\d+\.\d+\.\d+$/.test(bare) || bare.includes(":");
}

/**
 * Checks whether a hostname targets a private/internal network.
 * Deterministic hostname-string check; DNS-resolved addresses are checked
 * separately with isPrivateIp before any fetch (see webExtractor).
 */
export function isPrivateHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  const bare = lowered.replace(/^\[/, "").replace(/\]$/, "");

  // Bare / loopback / private-suffix names
  if (bare === "localhost" || bare.endsWith(".localhost")) return true;
  if (bare.endsWith(".local") || bare.endsWith(".internal")) return true;
  if (bare.endsWith(".home.arpa")) return true;
  if (bare.endsWith(".lan")) return true;
  if (bare === "metadata" || bare.endsWith(".metadata")) return true;

  // IP literals
  if (isIpLiteral(bare)) {
    return bare.includes(":") ? isPrivateIpv6(bare) : isPrivateIpv4(bare);
  }

  return false;
}

/** True when a resolved IP address (v4 or v6 string) is private/reserved. */
export function isPrivateIp(address: string): boolean {
  const value = address.toLowerCase();
  return value.includes(":") ? isPrivateIpv6(value) : isPrivateIpv4(value);
}

/** Registrable domain of a hostname (last two labels, keeping known multi-part suffixes simple). */
export function registrableDomain(hostname: string): string {
  const bare = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  const labels = bare.split(".").filter(Boolean);
  if (labels.length <= 2) return bare;
  return labels.slice(-2).join(".");
}

/**
 * Zod schema for URL input validation.
 */
export const urlInputSchema = z
  .string()
  .url("Must be a valid URL")
  .refine(isValidHttpUrl, "Only HTTP and HTTPS URLs are allowed")
  .refine(
    (url) => {
      const info = parseUrlInfo(url);
      return info !== null && !isPrivateHostname(info.hostname);
    },
    "Private/internal network URLs are not allowed",
  );
