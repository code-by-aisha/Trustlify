// Scratch utility for Phase 52 auth regression test.
// Gets an auth token for the mail.tm inbox created by createInbox.mjs (with retries).
const { readFileSync } = await import("node:fs");
const { address, mailPassword } = JSON.parse(
  readFileSync(new URL("./inbox.json", import.meta.url), "utf8"),
);

const BASE = "https://api.mail.tm";
let token = null;
for (let attempt = 1; attempt <= 6; attempt++) {
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password: mailPassword }),
  });
  const data = await res.json();
  if (data.token) {
    token = data.token;
    break;
  }
  console.log(`attempt ${attempt} failed (${res.status}), waiting 5s...`);
  await new Promise((r) => setTimeout(r, 5000));
}

if (!token) {
  console.error("TOKEN_FAILED");
  process.exit(1);
}

const { writeFileSync } = await import("node:fs");
writeFileSync(
  new URL("./inbox.json", import.meta.url),
  JSON.stringify({ address, mailPassword, token }, null, 2),
);
console.log("TOKEN_READY address=" + address);
