// Scratch: fetch a guerrilla mail message by id and extract links (Phase 52 test).
import { readFileSync } from "node:fs";

const mailId = process.argv[2];
if (!mailId) {
  console.error("Usage: node fetchEmail.mjs <mail_id>");
  process.exit(1);
}

const { sid } = JSON.parse(readFileSync(new URL("./guerrilla.json", import.meta.url), "utf8"));

const res = await fetch(
  `https://api.guerrillamail.com/ajax.php?f=fetch_email&sid_token=${sid}&email_id=${mailId}`,
  { headers: { "User-Agent": "TrustlifyPhase52Test/1.0" } },
);
const data = await res.json();

console.log("subject=" + data.mail_subject);
console.log("from=" + data.mail_from);
console.log("excerpt=" + (data.mail_excerpt || "").slice(0, 150).replace(/\s+/g, " "));

// Extract links from the body (HTML and plain parts)
const body = (data.mail_body || "") + " " + (data.mail_excerpt || "");
const urls = body.match(/https?:\/\/[^\s"'<>]+/g) || [];
const unique = [...new Set(urls)];
console.log("--- links found: " + unique.length + " ---");
for (const u of unique) {
  // Decode HTML entities commonly present in emails
  const decoded = u
    .replace(/&amp;/g, "&")
    .replace(/&#x3D;|&#61;/g, "=")
    .replace(/%3D/g, "=");
  console.log(decoded);
}
