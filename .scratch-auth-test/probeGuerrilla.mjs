// Scratch diagnostic for Phase 52:
// Gets a Guerrilla Mail address (no signup needed) and probes Supabase signup
// acceptance + whether a session is returned (email confirmation behavior).
import { readFileSync, writeFileSync } from "node:fs";

const envFile = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

// 1. Get a guerrilla mail address
const gmRes = await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address", {
  headers: { "User-Agent": "TrustlifyPhase52Test/1.0" },
});
const gm = await gmRes.json();
if (!gm.email_addr || !gm.sid_token) {
  console.error("GUERRILLA_FAILED " + JSON.stringify(gm).slice(0, 200));
  process.exit(1);
}
console.log("GUERRILLA_ADDRESS=" + gm.email_addr);
writeFileSync(
  new URL("./guerrilla.json", import.meta.url),
  JSON.stringify({ address: gm.email_addr, sid: gm.sid_token, ts: Date.now() }, null, 2),
);

// 2. Probe Supabase signup with that address
const res = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
  body: JSON.stringify({ email: gm.email_addr, password: "ProbeOnly-NotARealLogin1" }),
});

const body = await res.json();
console.log("HTTP_STATUS=" + res.status);
if (body.user) {
  console.log("user_id=" + body.user.id);
  console.log("email_confirmed_at=" + (body.user.email_confirmed_at ?? "null"));
  console.log("confirmation_sent_at=" + (body.user.confirmation_sent_at ?? "null"));
}
console.log("has_session=" + (body.session ? "true" : "false"));
if (body.error_code) console.log("error_code=" + body.error_code);
if (body.msg) console.log("msg=" + body.msg);
