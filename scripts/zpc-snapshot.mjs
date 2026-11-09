import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let csvPath = resolve(root, "data/zpc-snapshots.csv");
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--csv") csvPath = resolve(args[++i]);
  else throw new Error(`unknown arg ${args[i]}`);
}
const sitemapPath = resolve(root, "dist/sitemap.xml");
const sitemap = readFileSync(sitemapPath, "utf8");
const pageCount = (sitemap.match(/<loc>/g) || []).length;
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const token = process.env.ZPC_ANALYTICS_TOKEN || "";
const organic = "";
if (!existsSync(csvPath) || readFileSync(csvPath, "utf8").trim() === "") {
  writeFileSync(csvPath, "date,page_count,organic_visits\n");
}
const row = `${date},${pageCount},${organic}`;
appendFileSync(csvPath, `${row}\n`);
if (token) console.log("organic_visits blank: token is set but Account Analytics Read is not available");
else console.log("organic_visits blank: ZPC_ANALYTICS_TOKEN is unset");
console.log(row);
console.log(`csv ${csvPath}`);
if (!pageCount) process.exit(1);
