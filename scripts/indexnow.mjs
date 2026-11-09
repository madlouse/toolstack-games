#!/usr/bin/env node
/**
 * Submit every URL in the live (or local) sitemap to IndexNow (Bing / Yandex / etc.).
 * Key lives in data/indexnow.key (public by design; also served as dist/<key>.txt).
 *
 * Usage:
 *   node scripts/indexnow.mjs                  # fetch live sitemap + POST
 *   node scripts/indexnow.mjs --sitemap dist/sitemap.xml
 *   node scripts/indexnow.mjs --dry-run
 *
 * Run after each content deploy so Bing learns about new/changed pages without a Webmaster login.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "games.gettoolstacklab.com";
const CANONICAL = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS = 10000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sitemapArgIdx = args.indexOf("--sitemap");
const sitemapPath =
  sitemapArgIdx >= 0 ? resolve(args[sitemapArgIdx + 1] || "") : null;

function loadKey() {
  const p = resolve(ROOT, "data/indexnow.key");
  if (!existsSync(p)) {
    console.error("missing data/indexnow.key");
    process.exit(1);
  }
  const key = readFileSync(p, "utf8").trim();
  if (!/^[a-f0-9]{32}$/.test(key)) {
    console.error("data/indexnow.key must be exactly 32 lowercase hex chars");
    process.exit(1);
  }
  return key;
}

function parseLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return [...new Set(locs)].filter((u) => u.startsWith(CANONICAL));
}

async function loadSitemap() {
  if (sitemapPath) {
    if (!existsSync(sitemapPath)) {
      console.error(`sitemap not found: ${sitemapPath}`);
      process.exit(1);
    }
    return readFileSync(sitemapPath, "utf8");
  }
  const res = await fetch(`${CANONICAL}/sitemap.xml`);
  if (!res.ok) {
    console.error(`failed to fetch live sitemap: HTTP ${res.status}`);
    process.exit(1);
  }
  return await res.text();
}

async function main() {
  const key = loadKey();
  const keyLocation = `${CANONICAL}/${key}.txt`;
  const xml = await loadSitemap();
  const urlList = parseLocs(xml);
  if (urlList.length === 0) {
    console.error("no URLs found in sitemap");
    process.exit(1);
  }
  if (urlList.length > MAX_URLS) {
    console.error(`sitemap has ${urlList.length} URLs; IndexNow max is ${MAX_URLS}`);
    process.exit(1);
  }

  const body = { host: HOST, key, keyLocation, urlList };
  console.log(
    `IndexNow: ${urlList.length} URL(s) → ${ENDPOINT}${dryRun ? " (dry-run)" : ""}`
  );
  console.log(`keyLocation: ${keyLocation}`);

  if (dryRun) {
    console.log(JSON.stringify({ ...body, urlList: urlList.slice(0, 3).concat(["…"]) }, null, 2));
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ""}`);
  // 200 = OK, 202 = Accepted. Both mean the engine took the list.
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
