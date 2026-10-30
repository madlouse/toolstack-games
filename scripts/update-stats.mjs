#!/usr/bin/env node
/**
 * Merge an exported counts JSON into data/stats.json.
 *
 * Expected export shape (any of):
 *   { "spud-fling": { "visits": 10, "plays": 2 }, ... }
 *   { "counts": { "spud-fling": { "visits": 10, "plays": 2 } } }
 *
 * Merge strategy: for each slug present in the export, replace visits/plays
 * with the exported numbers (absolute, not delta). Unknown keys in export are
 * added. Existing _meta is preserved unless export provides _meta.
 *
 * Usage:
 *   node scripts/update-stats.mjs path/to/export.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const statsPath = resolve(root, "data/stats.json");
const exportPath = resolve(process.argv[2] || "");

if (!process.argv[2]) {
  console.error("Usage: node scripts/update-stats.mjs <export.json>");
  process.exit(1);
}

const stats = JSON.parse(readFileSync(statsPath, "utf8"));
const raw = JSON.parse(readFileSync(exportPath, "utf8"));
const counts = raw.counts && typeof raw.counts === "object" ? raw.counts : raw;

let updated = 0;
for (const [slug, val] of Object.entries(counts)) {
  if (slug.startsWith("_")) continue;
  if (!val || typeof val !== "object") continue;
  const visits = Number(val.visits ?? 0);
  const plays = Number(val.plays ?? 0);
  if (!Number.isFinite(visits) || !Number.isFinite(plays)) {
    console.error(`skip ${slug}: non-numeric visits/plays`);
    continue;
  }
  stats[slug] = { visits, plays };
  updated++;
  console.log(`set ${slug}: visits=${visits} plays=${plays} score=${plays * 3 + visits}`);
}

if (raw._meta && typeof raw._meta === "object") {
  stats._meta = { ...(stats._meta || {}), ...raw._meta };
}

writeFileSync(statsPath, JSON.stringify(stats, null, 2) + "\n");
console.log(`OK: updated ${updated} slug(s) in ${statsPath}`);
