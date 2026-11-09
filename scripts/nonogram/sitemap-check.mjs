import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const dist = resolve(root, "dist");
const origin = "https://games.gettoolstacklab.com";
const games = JSON.parse(readFileSync(resolve(root, "data/games.json"), "utf8"));
const doc = JSON.parse(readFileSync(resolve(root, "data/nonograms.json"), "utf8"));
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
const robots = readFileSync(join(dist, "robots.txt"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expected = new Set(["/", "/popular/", "/about/", "/content-policy/", ...games.map((game) => `/games/${game.slug}/`), "/nonogram/"]);
const sizes = [...new Set(doc.levels.map((level) => level.rows))];
for (const size of sizes) {
  expected.add(`/nonogram/${size}x${size}/`);
  for (const difficulty of ["easy", "medium", "hard"]) expected.add(`/nonogram/${size}x${size}/${difficulty}/`);
}
for (const level of doc.levels) {
  const seq = level.id.slice(level.id.lastIndexOf("-") + 1);
  expected.add(`/nonogram/${level.rows}x${level.cols}/${level.difficulty}/${seq}/`);
}
const got = new Set(locs.map((loc) => (loc.startsWith(origin) ? loc.slice(origin.length) || "/" : loc)));
const missing = [...expected].filter((path) => !got.has(path));
const extra = [...got].filter((path) => !expected.has(path));
const missingFiles = [...expected].filter((path) => {
  const file = path === "/" ? join(dist, "index.html") : join(dist, path.slice(1), "index.html");
  return !existsSync(file);
});
const robotsOk =
  /User-agent:\s*\*/.test(robots) &&
  /Allow:\s*\//.test(robots) &&
  !/Disallow:\s*\//.test(robots) &&
  robots.includes(`Sitemap: ${origin}/sitemap.xml`);
console.log(`sitemap ${locs.length}`);
console.log(`expected ${expected.size}`);
console.log(`preexisting ${4 + games.length}`);
console.log(`nonogramUrls ${expected.size - (4 + games.length)}`);
console.log(`missing ${missing.length}`);
console.log(`extra ${extra.length}`);
console.log(`missingFiles ${missingFiles.length}`);
console.log(`robotsOk ${robotsOk}`);
for (const path of missing) console.log(`missing ${path}`);
for (const path of extra) console.log(`extra ${path}`);
for (const path of missingFiles) console.log(`missingFile ${path}`);
if (!robotsOk) console.log(`robots:\n${robots}`);
if (missing.length || extra.length || missingFiles.length || !robotsOk) process.exit(1);
