// Scratch diagnostic for Phase 52:
// Probes whether Supabase email confirmation is enabled, by performing a signup
// (same call the real frontend makes) and inspecting whether a session is returned.
import { readFileSync } from "node:fs";

const envFile = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const probeEmail = `trustlify.probe.${Date.now().toString(36)}@example.com`;

const res = await fetch(`${url}/auth/v1/signup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
  body: JSON.stringify({ email: probeEmail, password: "ProbeOnly-NotARealLogin1" }),
});

const body = await res.json();
console.log("HTTP_STATUS=" + res.status);
if (body.user) {
  console.log("user_id=" + body.user.id);
  console.log("email_confirmed_at=" + (body.user.email_confirmed_at ?? "null"));
  console.log("confirmation_sent_at=" + (body.user.confirmation_sent_at ?? "null"));
  console.log("identities=" + JSON.stringify(body.user.identities?.map((i) => ({ id: i.id, confirmed: i.identity_data?.email_confirmed ?? "n/a" }))));
}
console.log("has_session=" + (body.session ? "true" : "false"));
if (body.error_code) console.log("error_code=" + body.error_code);
if (body.msg) console.log("msg=" + body.msg);
// Weak password check would also surface here (400 weak_password)
