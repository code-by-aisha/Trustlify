// Scratch: create a fresh guerrilla mail inbox for the student signup test.
// Overwrites guerrilla.json so the existing checkInbox/fetchEmail scripts work with it.
import { writeFileSync } from "node:fs";

const UA = { "User-Agent": "TrustlifyPhase52Test/1.0" };
const s = await (
  await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address", { headers: UA })
).json();
if (!s.sid_token || !s.email_addr) {
  console.error("FAILED " + JSON.stringify(s).slice(0, 200));
  process.exit(1);
}
writeFileSync(
  new URL("./guerrilla.json", import.meta.url),
  JSON.stringify({ address: s.email_addr, sid: s.sid_token }, null, 2),
);
console.log("address=" + s.email_addr);
