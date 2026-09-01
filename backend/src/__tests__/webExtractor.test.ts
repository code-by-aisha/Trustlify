/**
 * Trustlify Backend — Web Extractor Tests (Phase 4)
 *
 * Fixture-based only — NO network access (spec 42). The fetch implementation
 * and DNS resolver are injected fakes, so SSRF validation, per-hop redirect
 * re-validation, and content limits are all tested deterministically.
 *
 * Covers:
 *   - SSRF rejection (spec 08): private hostnames/IP literals, non-HTTP
 *     schemes, DNS-resolved private addresses, unresolvable hosts
 *   - Manual redirect following with full re-validation per hop (spec 08)
 *     and the redirect signal (spec 11)
 *   - HTTP errors and unsupported content types (spec 09)
 *   - HTML → readable text extraction (spec 10): noise stripped, entities
 *     decoded, structure preserved, truncation flagged
 *   - Honest publication-date parsing (only machine-readable metadata)
 */

import { describe, it, expect } from "vitest";
import {
  fetchWebContent,
  htmlToText,
  extractPublishedDate,
  isAcceptedContentType,
  WebFetchError,
  type FetchDeps,
} from "../investigation/webExtractor.js";

const PUBLIC_IP = "93.184.216.34";

/* ─── Fakes ───────────────────────────────────────────────────────────────── */

/** DNS fake: known hostnames resolve to their mapped addresses, others NXDOMAIN. */
function dnsFor(map: Record<string, string[]>): NonNullable<FetchDeps["dnsLookup"]> {
  return async (hostname: string) => {
    const addresses = map[hostname];
    if (!addresses) throw new Error("NXDOMAIN");
    return addresses;
  };
}

function htmlResponse(html: string, headers: Record<string, string> = {}): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

function redirectResponse(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

function pageDeps(
  map: Record<string, string[]>,
  handler: (url: string) => Response,
): FetchDeps {
  return {
    dnsLookup: dnsFor(map),
    fetchImpl: async (input: RequestInfo | URL) => handler(input.toString()),
  };
}

function expectCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(WebFetchError);
  expect((error as WebFetchError).code).toBe(code);
}

const SIMPLE_PAGE = (
  `<html><head><title>Example Scholarship Page</title></head>` +
  `<body><p>The XYZ scholarship is fully funded.</p></body></html>`
);

/* ─── SSRF validation (spec 08) ────────────────────────────────────────────── */

describe("webExtractor — SSRF validation", () => {
  it("rejects private hostnames outright", async () => {
    for (const url of [
      "http://localhost/admin",
      "http://127.0.0.1/secrets",
      "http://192.168.1.1/router",
      "http://10.0.0.5/internal",
      "http://169.254.169.254/latest/meta-data",
      "http://intranet.internal/portal",
    ]) {
      await expect(fetchWebContent(url)).rejects.toSatisfy((e: unknown) => {
        expectCode(e, "URL_REJECTED");
        return true;
      });
    }
  });

  it("rejects non-HTTP(S) schemes", async () => {
    await expect(
      fetchWebContent("ftp://example.com/file", {
        deps: { fetchImpl: async () => htmlResponse("") },
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "URL_REJECTED");
      return true;
    });
  });

  it("rejects a public hostname that DNS-resolves to a private address (DNS pinning)", async () => {
    const deps = pageDeps(
      { "rebind.example.org": ["10.0.0.8"] },
      () => htmlResponse(SIMPLE_PAGE),
    );
    await expect(
      fetchWebContent("https://rebind.example.org/page", { deps }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "PRIVATE_ADDRESS");
      return true;
    });
  });

  it("rejects a hostname that resolves to the cloud metadata address", async () => {
    const deps = pageDeps(
      { "meta.evil.example": ["169.254.169.254"] },
      () => htmlResponse(SIMPLE_PAGE),
    );
    await expect(
      fetchWebContent("https://meta.evil.example/creds", { deps }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "PRIVATE_ADDRESS");
      return true;
    });
  });

  it("rejects unresolvable hostnames", async () => {
    const deps = pageDeps({}, () => htmlResponse(SIMPLE_PAGE));
    await expect(
      fetchWebContent("https://no-such-host.example.net/page", { deps }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "FETCH_FAILED");
      return true;
    });
  });
});

/* ─── Redirect handling (spec 08/11) ───────────────────────────────────────── */

describe("webExtractor — redirects", () => {
  it("follows a cross-domain redirect and records the redirect signal", async () => {
    const deps = pageDeps(
      {
        "source.example.com": [PUBLIC_IP],
        "target.example.net": [PUBLIC_IP],
      },
      (url) =>
        url === "https://source.example.com/a"
          ? redirectResponse("https://target.example.net/b", 301)
          : htmlResponse(SIMPLE_PAGE),
    );

    const content = await fetchWebContent("https://source.example.com/a", { deps });

    expect(content.originalUrl).toBe("https://source.example.com/a");
    expect(content.finalUrl).toBe("https://target.example.net/b");
    expect(content.originalDomain).toBe("example.com");
    expect(content.finalDomain).toBe("example.net");
    expect(content.domainChanged).toBe(true);
  });

  it("resolves relative redirect targets and reports no domain change", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      (url) =>
        url === "https://example.com/a"
          ? redirectResponse("/b")
          : htmlResponse(SIMPLE_PAGE),
    );

    const content = await fetchWebContent("https://example.com/a", { deps });

    expect(content.finalUrl).toBe("https://example.com/b");
    expect(content.domainChanged).toBe(false);
    expect(content.originalDomain).toBe("example.com");
    expect(content.finalDomain).toBe("example.com");
  });

  it("re-validates every hop: a redirect to a private IP is rejected", async () => {
    const deps = pageDeps(
      { "good.example.com": [PUBLIC_IP] },
      () => redirectResponse("http://192.168.0.1/admin"),
    );
    await expect(
      fetchWebContent("https://good.example.com/a", { deps }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "URL_REJECTED");
      return true;
    });
  });

  it("re-validates every hop: a redirect to a privately-resolving hostname is rejected", async () => {
    const deps = pageDeps(
      {
        "good.example.com": [PUBLIC_IP],
        "inner.example.org": ["172.16.0.9"],
      },
      () => redirectResponse("https://inner.example.org/b"),
    );
    await expect(
      fetchWebContent("https://good.example.com/a", { deps }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "PRIVATE_ADDRESS");
      return true;
    });
  });

  it("rejects redirect chains that exceed the hop limit", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => redirectResponse("/loop"),
    );
    await expect(
      fetchWebContent("https://example.com/a", {
        deps,
        limits: { maxRedirects: 1 },
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expectCode(e, "TOO_MANY_REDIRECTS");
      return true;
    });
  });
});

/* ─── HTTP status + content type (spec 09) ─────────────────────────────────── */

describe("webExtractor — HTTP status and content type", () => {
  it("rejects non-2xx responses with HTTP_ERROR", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => new Response("Not Found", { status: 404 }),
    );
    await expect(fetchWebContent("https://example.com/missing", { deps })).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, "HTTP_ERROR");
        expect((e as WebFetchError).message).toContain("404");
        return true;
      },
    );
  });

  it("rejects unsupported content types", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse("%PDF-1.7", { "content-type": "application/pdf" }),
    );
    await expect(fetchWebContent("https://example.com/doc.pdf", { deps })).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, "UNSUPPORTED_CONTENT_TYPE");
        return true;
      },
    );
  });

  it("maps fetch failures with a TimeoutError name to TIMEOUT", async () => {
    const deps: FetchDeps = {
      dnsLookup: dnsFor({ "example.com": [PUBLIC_IP] }),
      fetchImpl: async () => {
        const error = new Error("The operation was aborted");
        error.name = "TimeoutError";
        throw error;
      },
    };
    await expect(fetchWebContent("https://example.com/slow", { deps })).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, "TIMEOUT");
        return true;
      },
    );
  });

  it("maps generic fetch failures to FETCH_FAILED", async () => {
    const deps: FetchDeps = {
      dnsLookup: dnsFor({ "example.com": [PUBLIC_IP] }),
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    };
    await expect(fetchWebContent("https://example.com/x", { deps })).rejects.toSatisfy(
      (e: unknown) => {
        expectCode(e, "FETCH_FAILED");
        return true;
      },
    );
  });
});

/* ─── Successful fetch + limits (spec 09/10/11) ────────────────────────────── */

describe("webExtractor — successful fetch", () => {
  it("extracts the title and readable text from an HTML page", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse(SIMPLE_PAGE),
    );

    const content = await fetchWebContent("https://example.com/page", { deps });

    expect(content.title).toBe("Example Scholarship Page");
    expect(content.text).toContain("The XYZ scholarship is fully funded.");
    expect(content.contentType).toBe("text/html");
    expect(content.contentTruncated).toBe(false);
    expect(content.domainChanged).toBe(false);
  });

  it("passes plain text through without HTML processing assumptions", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse("plain scholarship notice", { "content-type": "text/plain" }),
    );
    const content = await fetchWebContent("https://example.com/notice.txt", { deps });
    expect(content.text).toContain("plain scholarship notice");
    expect(content.contentType).toBe("text/plain");
  });

  it("flags contentTruncated when the character limit is exceeded", async () => {
    const longPage = `<html><body><p>${"A".repeat(500)}</p></body></html>`;
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse(longPage),
    );

    const content = await fetchWebContent("https://example.com/long", {
      deps,
      limits: { maxContentChars: 60 },
    });

    expect(content.contentTruncated).toBe(true);
    expect(content.text.length).toBeLessThanOrEqual(60);
  });

  it("flags contentTruncated when the byte limit cuts the download", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse(`<html><body><p>${"B".repeat(4000)}</p></body></html>`),
    );

    const content = await fetchWebContent("https://example.com/big", {
      deps,
      limits: { maxBytes: 200, maxContentChars: 100_000 },
    });

    expect(content.contentTruncated).toBe(true);
  });

  it("parses an honest publishedAt from meta metadata", async () => {
    const page = `<html><head>` +
      `<meta property="article:published_time" content="2026-01-15T10:00:00Z">` +
      `</head><body><p>Content</p></body></html>`;
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse(page),
    );

    const content = await fetchWebContent("https://example.com/dated", { deps });
    expect(content.publishedAt).toBe("2026-01-15T10:00:00.000Z");
  });

  it("reports publishedAt null when no machine-readable date exists", async () => {
    const deps = pageDeps(
      { "example.com": [PUBLIC_IP] },
      () => htmlResponse(SIMPLE_PAGE),
    );
    const content = await fetchWebContent("https://example.com/undated", { deps });
    expect(content.publishedAt).toBeNull();
  });
});

/* ─── htmlToText (spec 10) ─────────────────────────────────────────────────── */

describe("htmlToText", () => {
  it("strips script and style content entirely", () => {
    const html =
      `<html><head><title>T</title><style>body { color: red }</style></head>` +
      `<body><script>alert("evil")</script><p>Visible text</p></body></html>`;
    const { text } = htmlToText(html, 1000);
    expect(text).toContain("Visible text");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color: red");
  });

  it("decodes HTML entities", () => {
    const { text } = htmlToText("<p>Tom &amp; Jerry &lt;3 &quot;scholarships&quot;</p>", 1000);
    expect(text).toContain('Tom & Jerry <3 "scholarships"');
  });

  it("renders list items as bullets and blocks as separate lines", () => {
    const { text } = htmlToText(
      "<div><p>First paragraph.</p><ul><li>One</li><li>Two</li></ul></div>",
      1000,
    );
    expect(text).toContain("First paragraph.");
    expect(text).toContain("- One");
    expect(text).toContain("- Two");
  });

  it("flags truncation at the character cap", () => {
    const { text, truncated } = htmlToText(`<p>${"A".repeat(200)}</p>`, 50);
    expect(truncated).toBe(true);
    expect(text.length).toBe(50);
  });

  it("keeps an empty document empty", () => {
    const { text, truncated } = htmlToText("", 100);
    expect(text).toBe("");
    expect(truncated).toBe(false);
  });
});

/* ─── published date parsing (honest metadata only) ────────────────────────── */

describe("extractPublishedDate", () => {
  it("parses article:published_time meta tags", () => {
    expect(
      extractPublishedDate(
        `<meta property="article:published_time" content="2026-01-15T10:00:00Z">`,
      ),
    ).toBe("2026-01-15T10:00:00.000Z");
  });

  it("parses <time datetime> elements", () => {
    expect(extractPublishedDate(`<time datetime="2026-03-01">March 2026</time>`)).toBe(
      "2026-03-01T00:00:00.000Z",
    );
  });

  it("ignores non-date meta content", () => {
    expect(
      extractPublishedDate(`<meta property="article:published_time" content="spring 2026">`),
    ).toBeNull();
  });

  it("returns null when no date metadata exists", () => {
    expect(extractPublishedDate(`<p>Published somewhere in the past.</p>`)).toBeNull();
  });
});

/* ─── Content type validation ──────────────────────────────────────────────── */

describe("isAcceptedContentType", () => {
  it("accepts HTML, XHTML, and plain text (with parameters)", () => {
    expect(isAcceptedContentType("text/html; charset=utf-8")).toBe(true);
    expect(isAcceptedContentType("TEXT/HTML")).toBe(true);
    expect(isAcceptedContentType("application/xhtml+xml")).toBe(true);
    expect(isAcceptedContentType("text/plain")).toBe(true);
  });

  it("rejects binaries and empty headers", () => {
    expect(isAcceptedContentType("application/pdf")).toBe(false);
    expect(isAcceptedContentType("image/png")).toBe(false);
    expect(isAcceptedContentType("")).toBe(false);
  });
});
