/**
 * Trustlify Backend — Tavily Smoke Test (Phase 3B)
 *
 * Makes exactly ONE live Tavily Search API request to verify connectivity.
 * No retries, no fallbacks, no scraping of returned URLs.
 *
 * Usage: npm run smoke:tavily
 *
 * The API key is read from TAVILY_API_KEY and never printed.
 * Output is minimal: success/failure, query, result count, first title/domain.
 */

import "dotenv/config";
import { TavilySearchProvider } from "../search/TavilySearchProvider.js";
import { domainOf } from "../search/SearchProvider.js";
import { SearchError } from "../search/errors.js";

const SMOKE_QUERY = "official scholarship opportunity Pakistan";

async function main(): Promise<number> {
  const provider = new TavilySearchProvider();
  const startedAt = Date.now();

  console.log("─── Trustlify Tavily Smoke Test ───");
  console.log(`Query: "${SMOKE_QUERY}"`);
  console.log("");

  let output;
  try {
    output = await provider.search({ query: SMOKE_QUERY, maxResults: 5 });
  } catch (err) {
    if (err instanceof SearchError) {
      console.error(`LIVE REQUEST FAILED  [${err.code}]`);
      console.error(`Message: ${err.message}`);
      if (err.httpStatus) {
        console.error(`HTTP status: ${err.httpStatus}`);
      }
    } else {
      console.error("LIVE REQUEST FAILED  [UNKNOWN]");
      console.error(`Message: ${(err as Error).message}`);
    }
    return 1;
  }

  const durationMs = Date.now() - startedAt;

  console.log(`LIVE REQUEST SUCCEEDED in ${durationMs}ms`);
  console.log(`Number of results: ${output.results.length}`);

  if (output.results.length > 0) {
    const first = output.results[0];
    console.log(`First result title:  ${first.title}`);
    console.log(`First result domain: ${domainOf(first.url)}`);
  } else {
    console.log("No results returned (valid empty response).");
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Smoke test crashed:", (err as Error).message);
    process.exitCode = 1;
  });
