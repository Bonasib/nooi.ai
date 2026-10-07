// Email sign-in codes: 6 digits, one-time, 5 tries, 10-minute expiry. Run: node tests/otp_mock.mjs
import path from "path"; import url from "url";
process.chdir(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."));
const { newCode, checkCode } = await import("../lib/otp.js");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const c = newCode("a@x.com");
ok(/^\d{6}$/.test(c), "code is 6 digits");
ok(checkCode("a@x.com", c === "000000" ? "111111" : "000000") === "wrong", "wrong code is rejected");
ok(checkCode("a@x.com", c) === "ok", "right code signs in");
ok(checkCode("a@x.com", c) === "expired", "a code works only once");
const d = newCode("b@x.com"); const bad = d === "123456" ? "654321" : "123456";
for (let i = 0; i < 5; i++) checkCode("b@x.com", bad);
ok(checkCode("b@x.com", d) === "locked", "after 5 wrong tries even the right code is refused");
ok(checkCode("nobody@x.com", "123456") === "expired", "no code requested → expired");
const realNow = Date.now; const e = newCode("c@x.com"); Date.now = () => realNow() + 11 * 60e3;
ok(checkCode("c@x.com", e) === "expired", "codes expire after 10 minutes"); Date.now = realNow;
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
