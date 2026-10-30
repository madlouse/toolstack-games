#!/usr/bin/env node
/**
 * validate.mjs — fails if any game is missing license or source (or other required fields).
 * Usage: node validate.mjs [path-to-games.json]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED = [
  "slug",
  "title",
  "pitch",
  "description",
  "controls",
  "tags",
  "url",
  "embed",
  "thumbnail",
  "screenshots",
  "license",
  "source",
  "author",
  "added",
  "status",
];

const path = resolve(process.argv[2] || "data/games.json");
let games;
try {
  games = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`FAIL: cannot read ${path}: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(games) || games.length === 0) {
  console.error("FAIL: games.json must be a non-empty array");
  process.exit(1);
}

const errors = [];
const slugs = new Set();

for (const [i, g] of games.entries()) {
  const label = g?.slug || `#${i}`;
  for (const key of REQUIRED) {
    if (!(key in g) || g[key] === null || g[key] === undefined) {
      errors.push(`${label}: missing field "${key}"`);
      continue;
    }
    if (typeof g[key] === "string" && g[key].trim() === "") {
      errors.push(`${label}: empty field "${key}"`);
    }
  }
  // license + source hard fail (even if listed above, call out explicitly)
  if (!g.license || String(g.license).trim() === "") {
    errors.push(`${label}: LICENSE missing/empty (CONTENT-POLICY)`);
  }
  if (!g.source || String(g.source).trim() === "") {
    errors.push(`${label}: SOURCE missing/empty (CONTENT-POLICY)`);
  }
  // licenseUrl may be "n/a (self-made)" or a URL string — must exist as key OR license is self-made
  if (
    !("licenseUrl" in g) ||
    g.licenseUrl === null ||
    g.licenseUrl === undefined ||
    String(g.licenseUrl).trim() === ""
  ) {
    errors.push(`${label}: licenseUrl missing/empty (use a URL or "n/a (self-made)")`);
  }
  if (!Array.isArray(g.tags) || g.tags.length === 0) {
    errors.push(`${label}: tags must be a non-empty array`);
  }
  if (!Array.isArray(g.screenshots) || g.screenshots.length < 3) {
    errors.push(`${label}: screenshots must have at least 3 entries`);
  }
  if (typeof g.embed !== "boolean") {
    errors.push(`${label}: embed must be boolean`);
  }
  if (g.slug) {
    if (slugs.has(g.slug)) errors.push(`${label}: duplicate slug`);
    slugs.add(g.slug);
  }
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} validation error(s) in ${path}`);
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log(`OK: ${games.length} game(s) validated (${path})`);
