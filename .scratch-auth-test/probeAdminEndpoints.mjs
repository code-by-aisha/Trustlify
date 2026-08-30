// Scratch: probe which Supabase auth admin endpoints are exposed (read-only).
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const paths = ["/auth/v1/settings"];
for (const p of paths) {
  try {
    const r = await fetch(env.SUPABASE_URL + p, {
      headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: "Bearer " + env.SUPABASE_SECRET_KEY },
    });
    let body = "";
    if (r.ok) body = (await r.text());
    console.log(p + " -> HTTP " + r.status + (body ? "\n" + body : ""));
  } catch (e) {
    console.log(p + " -> ERR " + e.message);
  }
}
