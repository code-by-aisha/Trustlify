// Scratch: verify upsert-with-null semantics on the test user's profile row (Phase 52).
// Performs the exact operation the UI would do, then reads back.
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(new URL("../backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const H = {
  apikey: env.SUPABASE_SECRET_KEY,
  Authorization: "Bearer " + env.SUPABASE_SECRET_KEY,
  "Content-Type": "application/json",
  Accept: "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
};

// 1. Current state
let rows = await (await fetch(env.SUPABASE_URL + "/rest/v1/profiles?select=auth_user_id,education", { headers: H })).json();
const userId = rows[0].auth_user_id;
console.log("before: education=" + JSON.stringify(rows[0].education) + " user=" + userId.slice(0, 8) + "...");

// 2. Upsert with education: null (mirrors backend updateProfile payload, incl. on_conflict)
const upRes = await fetch(env.SUPABASE_URL + "/rest/v1/profiles?on_conflict=auth_user_id", {
  method: "POST",
  headers: H,
  body: JSON.stringify({ auth_user_id: userId, education: null }),
});
console.log("upsert status=" + upRes.status);
const upBody = await upRes.json();
if (Array.isArray(upBody)) {
  console.log("upsert returned education=" + JSON.stringify(upBody[0]?.education));
} else {
  console.log("upsert body=" + JSON.stringify(upBody).slice(0, 300));
}

// 3. Read back
rows = await (await fetch(env.SUPABASE_URL + "/rest/v1/profiles?select=education", { headers: H })).json();
console.log("after: education=" + JSON.stringify(rows[0].education));
