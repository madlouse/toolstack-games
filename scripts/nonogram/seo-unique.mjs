import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const dist = resolve(root, process.argv[2] || "dist");
const origin = "https://games.gettoolstacklab.com";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".html")) out.push(path);
  }
  return out;
}

function field(html, re) {
  const match = html.match(re);
  return match ? match[1] : "";
}

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
const problems = [];
let levelPages = 0;

for (const file of walk(dist)) {
  const html = readFileSync(file, "utf8");
  const rel = relative(dist, file).replaceAll("\\", "/");
  const title = field(html, /<title>([^<]*)<\/title>/);
  const description = field(html, /<meta name="description" content="([^"]*)"/);
  const canonical = field(html, /<link rel="canonical" href="([^"]*)"/);
  const h1 = field(html, /<h1>([^<]*)<\/h1>/);
  if (!title) problems.push(`${rel} missing title`);
  if (!description) problems.push(`${rel} missing description`);
  if (!h1) problems.push(`${rel} missing h1`);
  if (!canonical) problems.push(`${rel} missing canonical`);
  for (const [map, value, label] of [
    [titles, title, "title"],
    [descriptions, description, "description"],
    [canonicals, canonical, "canonical"],
  ]) {
    if (!value) continue;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(rel);
  }
  const level = /^nonogram\/\d+x\d+\/(?:easy|medium|hard)\/\d+\/index\.html$/.test(rel);
  if (!level) continue;
  levelPages++;
  const urlPath = `/${rel.slice(0, -"index.html".length)}`;
  if (canonical !== `${origin}${urlPath}`) problems.push(`${rel} canonical ${canonical}`);
  if (!html.includes("How to play")) problems.push(`${rel} missing how to play`);
  if (!html.includes(">Size<") || !html.includes(">Filled cells<") || !html.includes(">Difficulty<")) {
    problems.push(`${rel} missing stats`);
  }
  if (!html.includes("Previous level") || !html.includes("Next level")) problems.push(`${rel} missing prev/next`);
  if (!html.includes("Same size:")) problems.push(`${rel} missing same size`);
  if (!html.includes('href="/nonogram/"')) problems.push(`${rel} missing index`);
}

function dupes(map, label) {
  let n = 0;
  for (const [value, files] of map) {
    if (files.length > 1) {
      n++;
      problems.push(`duplicate ${label}: ${value} :: ${files.join(", ")}`);
    }
  }
  return n;
}

const duplicateTitles = dupes(titles, "title");
const duplicateDescriptions = dupes(descriptions, "description");
const duplicateCanonicals = dupes(canonicals, "canonical");
console.log(`files ${titles.size + (problems.filter((p) => p.includes("missing title")).length)}`);
console.log(`html ${walk(dist).length}`);
console.log(`levelPages ${levelPages}`);
console.log(`duplicateTitles ${duplicateTitles}`);
console.log(`duplicateDescriptions ${duplicateDescriptions}`);
console.log(`duplicateCanonicals ${duplicateCanonicals}`);
console.log(`problems ${problems.length}`);
for (const problem of problems) console.log(problem);
if (problems.length || duplicateTitles || duplicateDescriptions || duplicateCanonicals || levelPages < 300) {
  process.exit(1);
}
