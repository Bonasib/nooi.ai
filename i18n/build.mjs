// Shipped interface translations for the marketing page, sign-in screen and navigation.
// Source: i18n/en.txt + i18n/<lang>.txt ("NNN|text", one string per line, same numbers as en.txt).
// Output: public/i18n/<lang>.json  {"English string": "translation"} — loaded by the UI (and merged into the
// server's shared cache), so these screens are translated instantly for every visitor, signed in or not.
//   node i18n/build.mjs          rebuild public/i18n/*.json
//   node i18n/build.mjs --check  fail if a file is missing lines, has unknown numbers, or the JSON is stale
import fs from "fs"; import path from "path"; import url from "url";
const DIR = path.dirname(url.fileURLToPath(import.meta.url)), OUT = path.resolve(DIR, "../public/i18n");
const read = (f) => Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter((l) => /^\d{3}\|/.test(l)).map((l) => [l.slice(0, 3), l.slice(4).trim()]));
const en = read(path.join(DIR, "en.txt"));
const nums = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).match(/\d+/g) || [];
const check = process.argv.includes("--check"); let bad = 0;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(DIR).filter((f) => /^[a-z]{2,3}\.txt$/.test(f) && f !== "en.txt").sort()) {
  const lang = f.slice(0, -4), tr = read(path.join(DIR, f)), out = {}, problems = [];
  for (const n of Object.keys(tr)) if (!en[n]) problems.push(`unknown line ${n}`);
  for (const [n, s] of Object.entries(en)) {
    const t = tr[n];
    if (!t) { problems.push(`missing ${n}`); continue; }
    if (/[<>"]/.test(t)) problems.push(`${n} has < > or "`);
    const tn = nums(t); if (nums(s).some((x) => !tn.includes(x))) problems.push(`${n} lost a number: "${s}" → "${t}"`);
    out[s] = t;
  }
  const json = JSON.stringify(out, null, 0) + "\n", file = path.join(OUT, lang + ".json");
  if (check) { if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== json) problems.push(`public/i18n/${lang}.json is stale — run node i18n/build.mjs`); }
  else fs.writeFileSync(file, json);
  if (problems.length) { bad++; console.log(`✗ ${lang}: ${problems.join(" · ")}`); }
  else console.log(`✓ ${lang}: ${Object.keys(out).length} strings`);
}
process.exit(bad ? 1 : 0);
