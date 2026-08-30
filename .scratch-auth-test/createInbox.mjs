// Scratch utility for Phase 52 auth regression test.
// Creates a real mail.tm inbox (credentials saved immediately) and gets an auth token.
import { writeFileSync } from "node:fs";

const BASE = "https://api.mail.tm";

// 1. Get available domain
const domRes = await fetch(`${BASE}/domains`);
const domJson = await domRes.json();
const domains = domJson["hydra:member"] ?? domJson;
if (!Array.isArray(domains) || domains.length === 0) {
  console.error("NO_DOMAINS");
  process.exit(1);
}
const domain = domains[0].domain;

// 2. Create account with random address
const user = `trustlify.p52.${Date.now().toString(36)}`;
const address = `${user}@${domain}`;
const mailPassword = `Ph52x${Math.random().toString(36).slice(2, 12)}`;

const createRes = await fetch(`${BASE}/accounts`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address, password: mailPassword }),
});
if (createRes.status !== 201) {
  console.error("ACCOUNT_CREATE_FAILED " + createRes.status + " " + (await createRes.text()));
  process.exit(1);
}

// Save credentials immediately so nothing is lost
writeFileSync(
  new URL("./inbox.json", import.meta.url),
  JSON.stringify({ address, mailPassword, token: null }, null, 2),
);
console.log("ACCOUNT_CREATED address=" + address);

// 3. Get auth token (with retries — mail.tm login can lag after signup)
let token = null;
for (let attempt = 1; attempt <= 8; attempt++) {
  await new Promise((r) => setTimeout(r, attempt === 1 ? 2000 : 5000));
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password: mailPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.token) {
    token = data.token;
    break;
  }
  console.log(`token attempt ${attempt} failed (${res.status})`);
}

if (!token) {
  console.error("TOKEN_FAILED");
  process.exit(1);
}

writeFileSync(
  new URL("./inbox.json", import.meta.url),
  JSON.stringify({ address, mailPassword, token }, null, 2),
);
console.log("TOKEN_READY");
