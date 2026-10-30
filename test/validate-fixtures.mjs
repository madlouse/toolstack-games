#!/usr/bin/env node
/**
 * Fixture tests for validate.mjs (H-01). Each case runs `node validate.mjs <fixture> --vercel <csp fixture>`
 * and asserts the exit code AND that the expected rule message appears (so a case can't pass for the wrong reason).
 * Fixtures live in test/fixtures/ and are never read by build.mjs (it only reads data/games.json), so they are not shipped.
 * Usage: node test/validate-fixtures.mjs     exit 1 if any case does not behave as expected.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FX = "test/fixtures/";
const VF = FX + "vercel.fixture.json";
const CASES = [
  // [games file, vercel file, expected exit, regex the output must contain]
  ["data/games.json", "vercel.json", 0, /OK: 3 game\(s\) validated/],
  [FX + "valid-third-party.json", VF, 0, /OK: 1 game\(s\) validated/],
  [FX + "gpl.json", VF, 1, /licen[cs]e "GPL-3\.0-only" is copyleft/],
  [FX + "agpl.json", VF, 1, /licen[cs]e "AGPL-3\.0" is copyleft/],
  [FX + "lgpl.json", VF, 1, /licen[cs]e "LGPL-2\.1-or-later" is copyleft/],
  [FX + "cc-by-nc.json", VF, 1, /licen[cs]e "CC-BY-NC-4\.0" is NonCommercial/],
  [FX + "cc-by-sa.json", VF, 1, /licen[cs]e "CC-BY-SA-3\.0" is ShareAlike/],
  [FX + "unknown-license.json", VF, 1, /licen[cs]e "unknown" is not in the allowlist/],
  [FX + "unlisted-license.json", VF, 1, /licen[cs]e "WTFPL" is not in the allowlist/],
  [FX + "licenseurl-http.json", VF, 1, /licenseUrl must be an https:\/\/ URL/],
  [FX + "licenseurl-na.json", VF, 1, /licenseUrl must be an https:\/\/ URL/],
  [FX + "licenseurl-bad-syntax.json", VF, 1, /licenseUrl must be an https:\/\/ URL/],
  [FX + "missing-evidence.json", VF, 1, /licenseEvidence/],
  [FX + "evidence-own-site.json", VF, 1, /licenseUrl points at this hub/],
  [FX + "missing-copyright-notice.json", VF, 1, /copyrightNotice/],
  [FX + "source-not-url.json", VF, 1, /source must be an https:\/\/ URL/],
  [FX + "missing-frame.json", VF, 1, /origin https:\/\/not-in-frame-src\.example\.net is not in vercel\.json frame-src/],
  [FX + "third-party-same-origin.json", VF, 1, /third-party game must be served from its own origin/],
  [FX + "forbidden-field.json", VF, 1, /forbidden field "aggregateRating"/],
  [FX + "unknown-field.json", VF, 1, /unknown field "licence"/],
  [FX + "testnote-no-source.json", VF, 1, /testNotes "Frame rate on a real phone": a measured value needs a source/],
  [FX + "goal-bad-threshold.json", VF, 1, /needs a name and a positive integer threshold/],
  ["data/games.json", FX + "vercel.missing-bloom.json", 1, /origin https:\/\/bloom-isle\.gettoolstacklab\.com is not in vercel\.json frame-src/],
  ["data/games.json", FX + "vercel.missing-classics.json", 1, /merge-tiles: embed origin https:\/\/tsl-classics\.pages\.dev is not in vercel\.json frame-src/],
];

let bad = 0;
for (const [file, vercel, want, re] of CASES) {
  const r = spawnSync(process.execPath, ["validate.mjs", file, "--vercel", vercel], { cwd: ROOT, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const ok = r.status === want && re.test(out);
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${file} (vercel=${vercel}) exit=${r.status} want=${want} ${ok ? "" : "missing /" + re.source + "/"}`);
  if (!ok) console.log("      " + out.trim().split("\n").join("\n      "));
}
console.log(`\n${CASES.length - bad}/${CASES.length} validate fixture cases behave as expected`);
process.exit(bad ? 1 : 0);
