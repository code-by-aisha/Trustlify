/**
 * Read-only diagnostic — lists auth users (no modification).
 * Shows when confirmation/recovery emails were last sent, to determine
 * when the Supabase email rate-limit window clears.
 * Prints emails partially masked; never prints keys.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(resolve(__dirname, "../../.env"), "utf8");
const env: Record<string, string> = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabaseAdmin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (error) {
  console.error("LIST_FAILED: " + error.message);
  process.exit(1);
}

const users = data.users ?? [];
console.log("total_users=" + users.length);
console.log("now_utc=" + new Date().toISOString());

for (const u of users) {
  const mask = (e: string | undefined | null) =>
    e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : "(none)";
  console.log(
    [
      "email=" + mask(u.email),
      "created=" + (u.created_at ?? ""),
      "confirmed=" + (u.email_confirmed_at ?? "never"),
      "conf_sent=" + (u.confirmation_sent_at ?? "never"),
      "recovery_sent=" + ((u as unknown as { recovery_sent_at?: string }).recovery_sent_at ?? "never"),
      "last_sign_in=" + (u.last_sign_in_at ?? "never"),
    ].join(" "),
  );
}
