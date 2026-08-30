// Scratch: check the guerrilla mail inbox for messages (Phase 52 test).
import { readFileSync } from "node:fs";

const { address, sid } = JSON.parse(
  readFileSync(new URL("./guerrilla.json", import.meta.url), "utf8"),
);

const res = await fetch(
  `https://api.guerrillamail.com/ajax.php?f=check_email&sid_token=${sid}&seq=0`,
  { headers: { "User-Agent": "TrustlifyPhase52Test/1.0" } },
);
const data = await res.json();
console.log("inbox=" + address);
console.log("list_empty=" + JSON.stringify(data.list === "" || data.list === "[]"));
if (Array.isArray(data.list) && data.list.length > 0) {
  for (const m of data.list) {
    console.log(`mail_from=${m.mail_from} subject=${m.mail_subject} id=${m.mail_id}`);
  }
} else {
  console.log("no messages yet");
}
