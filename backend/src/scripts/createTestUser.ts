/**
 * Trustlify Backend — Test User Creator (dev utility)
 *
 * Creates (or re-confirms) a test user via the Supabase admin auth API.
 * Useful when the public signup endpoint is rate-limited (HTTP 429) during
 * local browser testing. The service-role key bypasses signup rate limits.
 *
 * Usage: npx tsx --env-file=.env src/scripts/createTestUser.ts <email> <password>
 *
 * Never print secrets. Only creates/updates the named user — touches nothing else.
 */

import { supabaseAdmin } from "../config/supabase.js";

async function main(): Promise<number> {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx --env-file=.env src/scripts/createTestUser.ts <email> <password>");
    return 1;
  }

  // Does the user already exist?
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const found = existing?.users?.find((u) => u.email === email);

  if (found) {
    // Re-confirm the email so login works without a verification email.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, {
      email_confirm: true,
      password,
    });
    if (error) {
      console.error(`UPDATE FAILED: ${error.message}`);
      return 1;
    }
    console.log(`TEST USER UPDATED (email confirmed): ${email}`);
    return 0;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error(`CREATE FAILED: ${error.message}`);
    return 1;
  }

  console.log(`TEST USER CREATED (email confirmed): ${email}`);
  console.log(`User id: ${data.user?.id ?? "(unknown)"}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("Script crashed:", (err as Error).message);
    process.exitCode = 1;
  });
