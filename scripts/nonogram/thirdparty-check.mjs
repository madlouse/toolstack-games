import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const dist = resolve(root, "dist");
const allowed = new Set(["games.gettoolstacklab.com"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = [...walk(join(dist, "nonogram")), join(dist, "nonogram.js")];
const hits = [];
let styleAttrs = 0;
let inlineScripts = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = relative(dist, file);
  if (file.endsWith(".html")) {
    styleAttrs += (text.match(/\sstyle\s*=/gi) || []).length;
    for (const tag of text.match(/<script\b[^>]*>/gi) || []) {
      if (!/\ssrc\s*=/i.test(tag)) inlineScripts++;
    }
    for (const tag of text.match(/<(?:script|link|img|iframe)\b[^>]*>/gi) || []) {
      const kind = /^<(\w+)/.exec(tag)[1].toLowerCase();
      const attr = kind === "link" ? "href" : "src";
      const match = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
      if (!match) continue;
      const url = match[1];
      if (!/^https?:\/\//i.test(url)) continue;
      let host = "";
      try {
        host = new URL(url).host;
      } catch {
        host = "unparsed";
      }
      if (!allowed.has(host)) hits.push(`${rel} ${kind} ${url}`);
    }
  } else if (/https?:\/\//i.test(text)) {
    hits.push(`${rel} contains an http URL`);
  }
}

console.log(`files ${files.length}`);
console.log(`externalHits ${hits.length}`);
console.log(`styleAttributes ${styleAttrs}`);
console.log(`inlineScripts ${inlineScripts}`);
for (const hit of hits) console.log(hit);
if (hits.length || styleAttrs || inlineScripts) process.exit(1);
