// Scratch: read-only dump of the profiles table (Phase 52 diagnostics).
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const res = await fetch(
  env.SUPABASE_URL + "/rest/v1/profiles?select=auth_user_id,display_name,education,age,location,language,updated_at",
  {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: "Bearer " + env.SUPABASE_SECRET_KEY,
      Accept: "application/json",
    },
  },
);
console.log("HTTP " + res.status);
const rows = await res.json();
for (const r of rows) {
  const mask = (id) => id.slice(0, 8) + "...";
  console.log(
    "user=" + mask(r.auth_user_id) +
    " display_name=" + JSON.stringify(r.display_name) +
    " education=" + JSON.stringify(r.education) +
    " age=" + JSON.stringify(r.age) +
    " location=" + JSON.stringify(r.location) +
    " language=" + JSON.stringify(r.language) +
    " updated_at=" + r.updated_at,
  );
}
