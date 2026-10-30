#!/usr/bin/env node
/**
 * validate.mjs — the hub's data gate (CONTENT-POLICY.md). Fails the build on any policy breach.
 *
 * Usage: node validate.mjs [games.json] [--vercel vercel.json] [--check-urls]
 *   games.json     default data/games.json
 *   --vercel       CSP source for the frame-src check (default vercel.json next to this script)
 *   --check-urls   also HEAD-check (GET fallback) every licence/proof/source URL over the network; off by
 *                  default so the build (and Vercel) never depends on the network
 *
 * Rules (each one has a failing fixture in test/fixtures, run by `node test/validate-fixtures.mjs`):
 *  - required fields present and non-empty; slugs unique; tags/screenshots/embed shapes
 *  - licence must be on ALLOWED_LICENSES; copyleft (GPL/AGPL/LGPL/MPL/EPL/CC-BY-SA), NonCommercial,
 *    NoDerivatives and unknown licences fail with a reason
 *  - licenseUrl must be a syntactically valid https:// URL (no "n/a")
 *  - third-party (non self-made) games also need: licenseEvidence {url, quote, checked}, a licenseUrl that is
 *    not on this hub (real proof), source as an https URL, copyrightNotice (except CC0), modifications notes
 *  - every embed:true game's origin must be listed in vercel.json CSP frame-src ('self' for same-origin paths);
 *    a third-party game must be on its own origin, never same-origin with the hub
 *  - forbidden fields (ratings, analytics/ads/tracking, personal data) fail; unknown fields fail (typo guard)
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const HUB_ORIGIN = "https://games.gettoolstacklab.com";
const SELF_MADE = "self-made";

// Lead-approved allowlist (HUB-NEXT-TASKS H-01; copyleft out for now per Lead decision 4). SPDX ids.
export const ALLOWED_LICENSES = [
  SELF_MADE,
  "CC0-1.0",
  "MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Zlib",
  "CC-BY-4.0",
];
const NO_NOTICE_NEEDED = new Set([SELF_MADE, "CC0-1.0"]);
const FORBIDDEN_LICENSE = [
  [/(^|[^A-Z])(A|L)?GPL/i, "copyleft (GPL family is not allowed in the hub)"],
  [/\b(MPL|EPL|EUPL|CDDL|OSL)\b/i, "copyleft (weak copyleft is not allowed in the hub)"],
  [/(^|-)NC(-|$)|non-?commercial/i, "NonCommercial (the hub must allow commercial use)"],
  [/(^|-)ND(-|$)|no-?deriv/i, "NoDerivatives (we must be able to modify/trim builds)"],
  [/(^|-)SA(-|$)|share-?alike/i, "ShareAlike copyleft (not allowed in the hub)"],
];

const REQUIRED = [
  "slug", "title", "pitch", "description", "controls", "tags", "url", "embed", "thumbnail",
  "screenshots", "license", "licenseUrl", "source", "author", "added", "status",
];
const THIRD_PARTY_REQUIRED = ["licenseEvidence", "copyrightNotice", "modifications"];
const OPTIONAL = [
  "howToPlay", "controlsShort", "controlsKeyboard", "controlsTouch", "tips", "faq", "similarGenres", "playMode", "inLanguage",
  "applicationCategory", "operatingSystem", "gamePlatform", "seoTitle", "seoDescription", "subline",
  "definition", "genreLabel", "coverAlt", "screenshotAlts", "updated", "cover",
  // provenance / credits (H-02)
  "licenseEvidence", "copyrightNotice", "sourceCommit", "authorUrl", "modifications", "shelf",
  // first-hand content (H-06)
  "goals", "howWeMade",
];
const KNOWN = new Set([...REQUIRED, ...OPTIONAL]);
// Fields that would publish fake social proof or imply tracking / personal data (CONTENT-POLICY: privacy, SEO-PLAN §6)
const FORBIDDEN_FIELDS = [
  "aggregateRating", "rating", "ratingValue", "ratingCount", "reviews", "review", "reviewCount",
  "analytics", "analyticsId", "trackingId", "gaId", "gtag", "pixel", "ads", "adNetwork", "adUnit",
  "externalScripts", "scripts", "cookies", "email", "contactEmail", "personalData", "userData",
];
const SHELVES = new Set(["3d", "classics"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv) {
  const a = { file: "data/games.json", vercel: resolve(ROOT, "vercel.json"), checkUrls: false };
  const rest = [...argv];
  let fileSet = false;
  while (rest.length) {
    const x = rest.shift();
    if (x === "--vercel") a.vercel = resolve(rest.shift() || "");
    else if (x === "--check-urls") a.checkUrls = true;
    else if (!fileSet) { a.file = x; fileSet = true; }
    else throw new Error(`unexpected argument ${x}`);
  }
  a.file = resolve(a.file);
  return a;
}

export function httpsUrl(s) {
  if (typeof s !== "string" || !/^https:\/\//.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

export function frameSrcOf(vercel) {
  for (const h of vercel?.headers || []) {
    if (h.source !== "/(.*)") continue;
    for (const x of h.headers || []) {
      if (String(x.key).toLowerCase() !== "content-security-policy") continue;
      const d = String(x.value).split(";").map((s) => s.trim()).find((s) => s.startsWith("frame-src "));
      if (d) return d.split(/\s+/).slice(1).map((t) => t.replace(/\/$/, ""));
    }
  }
  return null;
}

/** Pure check: returns {errors, warnings}. */
export function validateGames(games, vercel) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(games) || games.length === 0) return { errors: ["games.json must be a non-empty array"], warnings };
  const frameSrc = frameSrcOf(vercel);
  if (!frameSrc) errors.push(`vercel.json: no Content-Security-Policy frame-src on source "/(.*)"`);
  const usedOrigins = new Set();
  const slugs = new Set();

  for (const [i, g] of games.entries()) {
    const label = g?.slug || `#${i}`;
    const err = (m) => errors.push(`${label}: ${m}`);
    for (const key of REQUIRED) {
      if (!(key in g) || g[key] === null || g[key] === undefined) err(`missing field "${key}"`);
      else if (typeof g[key] === "string" && g[key].trim() === "") err(`empty field "${key}"`);
    }
    for (const key of Object.keys(g)) {
      if (FORBIDDEN_FIELDS.includes(key)) err(`forbidden field "${key}" (no ratings, tracking, ads or personal data)`);
      else if (!KNOWN.has(key)) err(`unknown field "${key}" (add it to KNOWN in validate.mjs if intended)`);
    }
    if (!Array.isArray(g.tags) || g.tags.length === 0) err("tags must be a non-empty array");
    if (!Array.isArray(g.screenshots) || g.screenshots.length < 3) err("screenshots must have at least 3 entries");
    if (typeof g.embed !== "boolean") err("embed must be boolean");
    if (g.shelf !== undefined && !SHELVES.has(g.shelf)) err(`shelf "${g.shelf}" must be one of ${[...SHELVES].join(", ")}`);
    if (g.slug) {
      if (slugs.has(g.slug)) err("duplicate slug");
      slugs.add(g.slug);
    }

    // --- licence ---
    const lic = String(g.license ?? "").trim();
    const thirdParty = lic !== SELF_MADE;
    const forbidden = FORBIDDEN_LICENSE.find(([re]) => re.test(lic));
    if (forbidden) err(`licence "${lic}" is ${forbidden[1]}`);
    else if (lic && !ALLOWED_LICENSES.includes(lic)) err(`licence "${lic}" is not in the allowlist (${ALLOWED_LICENSES.join(", ")})`);
    const licUrl = httpsUrl(g.licenseUrl);
    if (!licUrl) err(`licenseUrl must be an https:// URL (got ${JSON.stringify(g.licenseUrl)})`);

    if (thirdParty) {
      for (const k of THIRD_PARTY_REQUIRED) {
        if (k === "copyrightNotice" && NO_NOTICE_NEEDED.has(lic)) continue;
        if (g[k] === undefined || g[k] === null || (typeof g[k] === "string" && !g[k].trim()))
          err(`third-party game needs "${k}"${k === "licenseEvidence" ? " {url, quote, checked}" : k === "copyrightNotice" ? " (MIT/BSD/Apache/Zlib/CC-BY require the notice to be retained)" : " (what we changed; \"None\" if nothing)"}`);
      }
      const ev = g.licenseEvidence;
      if (ev !== undefined && ev !== null) {
        if (typeof ev !== "object") err("licenseEvidence must be an object {url, quote, checked}");
        else {
          if (!httpsUrl(ev.url)) err("licenseEvidence.url must be an https:// URL");
          if (typeof ev.quote !== "string" || ev.quote.trim().length < 20) err("licenseEvidence.quote must quote the licence text (≥20 chars)");
          if (!DATE.test(String(ev.checked || ""))) err("licenseEvidence.checked must be YYYY-MM-DD");
        }
      }
      if (licUrl && licUrl.origin === HUB_ORIGIN) err("licenseUrl points at this hub; a third-party licence needs the upstream proof URL");
      if (!httpsUrl(g.source)) err(`source must be an https:// URL for a third-party game (got ${JSON.stringify(g.source)})`);
      if (g.authorUrl !== undefined && !httpsUrl(g.authorUrl)) err("authorUrl must be an https:// URL");
      if (/toolstack/i.test(String(g.author || ""))) err("third-party game cannot have author Toolstack Lab");
    }

    // --- embed origin vs CSP frame-src ---
    if (g.embed === true && typeof g.url === "string") {
      let origin = null;
      if (g.url.startsWith("/")) origin = "'self'";
      else {
        const u = httpsUrl(g.url);
        if (!u) err(`url must be https:// or a same-origin /path (got ${JSON.stringify(g.url)})`);
        else origin = u.origin === HUB_ORIGIN ? "'self'" : u.origin;
      }
      if (origin) {
        usedOrigins.add(origin);
        if (thirdParty && origin === "'self'")
          err("third-party game must be served from its own origin (separate subdomain or pages.dev), not same-origin with the hub");
        if (frameSrc && !frameSrc.includes(origin))
          err(`embed origin ${origin} is not in vercel.json frame-src (${frameSrc.join(" ")})`);
      }
    }
  }
  for (const o of frameSrc || []) if (!usedOrigins.has(o)) warnings.push(`frame-src lists ${o} but no embed:true game uses it`);
  return { errors, warnings };
}

async function checkUrls(games) {
  const errs = [];
  const urls = new Set();
  for (const g of games) {
    for (const u of [g.licenseUrl, g.licenseEvidence?.url, g.source, g.authorUrl]) if (httpsUrl(u)) urls.add(u);
  }
  for (const u of urls) {
    let status = 0;
    for (const method of ["HEAD", "GET"]) {
      try {
        const r = await fetch(u, { method, redirect: "follow", signal: AbortSignal.timeout(15000) });
        status = r.status;
        if (r.ok) break;
      } catch (e) {
        status = `network error: ${e.message}`;
      }
    }
    const ok = typeof status === "number" && status >= 200 && status < 400;
    console.log(`${ok ? "url ok " : "url BAD"} ${status} ${u}`);
    if (!ok) errs.push(`URL check failed (${status}): ${u}`);
  }
  return errs;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`FAIL: ${e.message}`);
    process.exit(2);
  }
  let games, vercel;
  try {
    games = JSON.parse(readFileSync(args.file, "utf8"));
  } catch (e) {
    console.error(`FAIL: cannot read ${args.file}: ${e.message}`);
    process.exit(1);
  }
  try {
    vercel = JSON.parse(readFileSync(args.vercel, "utf8"));
  } catch (e) {
    console.error(`FAIL: cannot read ${args.vercel}: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings } = validateGames(games, vercel);
  if (args.checkUrls && Array.isArray(games)) errors.push(...(await checkUrls(games)));
  for (const w of warnings) console.warn("WARN:", w);
  if (errors.length) {
    console.error(`FAIL: ${errors.length} validation error(s) in ${args.file}`);
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(`OK: ${games.length} game(s) validated (${args.file}; frame-src from ${args.vercel}${args.checkUrls ? "; URLs checked" : ""})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
