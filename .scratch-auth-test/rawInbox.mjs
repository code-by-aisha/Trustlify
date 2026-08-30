// Scratch: raw dump of guerrilla mail inbox (Phase 52 test).
import { readFileSync } from "node:fs";

const { sid } = JSON.parse(readFileSync(new URL("./guerrilla.json", import.meta.url), "utf8"));

const res = await fetch(
  `https://api.guerrillamail.com/ajax.php?f=get_email_list&sid_token=${sid}&offset=0`,
  { headers: { "User-Agent": "TrustlifyPhase52Test/1.0" } },
);
const raw = await res.text();
console.log(raw.slice(0, 3000));
