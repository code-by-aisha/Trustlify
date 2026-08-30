// Scratch: re-attach a fresh guerrilla mail session to the existing test inbox.
import { readFileSync, writeFileSync } from "node:fs";

const { address } = JSON.parse(readFileSync(new URL("./guerrilla.json", import.meta.url), "utf8"));
const user = address.split("@")[0];
const UA = { "User-Agent": "TrustlifyPhase52Test/1.0" };

// 1. Fresh session
const s1 = await (await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address", { headers: UA })).json();
if (!s1.sid_token) {
  console.error("SESSION_FAILED " + JSON.stringify(s1).slice(0, 200));
  process.exit(1);
}

// 2. Switch session to the existing test inbox user
const s2 = await (await fetch(
  `https://api.guerrillamail.com/ajax.php?f=set_email_user&email_user=${user}&sid_token=${s1.sid_token}`,
  { headers: UA },
)).json();
console.log("set_email_user ok=" + (s2.auth?.success === true || s2.email_addr === address));
console.log("session_email=" + (s2.email_addr ?? address));

// 3. Verify by listing
const s3 = await (await fetch(
  `https://api.guerrillamail.com/ajax.php?f=get_email_list&sid_token=${s1.sid_token}&offset=0`,
  { headers: UA },
)).json();

writeFileSync(
  new URL("./guerrilla.json", import.meta.url),
  JSON.stringify({ address, sid: s1.sid_token, ts: Date.now() }, null, 2),
);

const list = s3.list;
if (Array.isArray(list) && list.length > 0) {
  for (const m of list) {
    console.log(`mail id=${m.mail_id} from=${m.mail_from} subject=${m.mail_subject}`);
  }
} else {
  console.log("list_type=" + typeof list + " list_value=" + JSON.stringify(list)?.slice(0, 200));
  console.log("INBOX_EMPTY_OR_NOT_ATTACHED");
}
