/**
 * Trustlify Backend — URL Safety Utility
 *
 * Utilities for validating and parsing URLs submitted by users.
 * Phase 1: Basic validation. Full redirect tracking and SSRF protection in later phases.
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
 * Checks whether a hostname targets a private/internal network.
 * Future: expand to cover full RFC 1918 ranges, IPv6 loopback, etc.
 */
export function isPrivateHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  if (lowered === "localhost") return true;
  if (lowered.startsWith("127.")) return true;
  if (lowered.startsWith("10.")) return true;
  if (lowered.startsWith("192.168.")) return true;
  if (lowered === "0.0.0.0") return true;
  if (lowered.endsWith(".local")) return true;
  if (lowered.endsWith(".internal")) return true;
  return false;
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
