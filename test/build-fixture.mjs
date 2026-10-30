#!/usr/bin/env node
/**
 * H-02 fixture build: builds the hub with data/games.json + one fake third-party MIT classic
 * (test/fixtures/valid-third-party.json) into a temp dir (never dist/), then asserts the credits are data-driven:
 *  - the classic's page has no "Code and art are our own", credits author/licence/proof/copyright/source/changes,
 *    and JSON-LD author.name === games.json author, license === licenseUrl
 *  - About/home stop saying "Every game is our own" and use the decided "mostly 3D, plus a few selected classics"
 *  - the self-made pages keep their self-made credits
 * H-09: the production data now lists a real classic (Merge Tiles), so the prod build must use the mixed wording,
 * give only third-party iframes a sandbox, and show the Classics shelf; an own-games-only dataset must build exactly
 * the old way (no Classics shelf, no sandbox, "Every game is our own").
 * Usage: node test/build-fixture.mjs     exit 1 on any failed assertion.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const real = JSON.parse(readFileSync(join(ROOT, "data/games.json"), "utf8"));
const classic = JSON.parse(readFileSync(join(ROOT, "test/fixtures/valid-third-party.json"), "utf8"))[0];
const tmp = mkdtempSync(join(tmpdir(), "hub-fixture-"));
const data = join(tmp, "games.json");
writeFileSync(data, JSON.stringify([...real, classic], null, 2));
const ownData = join(tmp, "games-own.json");
writeFileSync(ownData, JSON.stringify(real.filter((g) => g.license === "self-made"), null, 2));
const SANDBOX = 'sandbox="allow-scripts allow-same-origin allow-pointer-lock"';
const iframeTag = (html) => (html.match(/<iframe\b[^>]*>/) || [""])[0];

function build(args, out) {
  const r = spawnSync(process.execPath, ["build.mjs", ...args, "--out", out], { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, log: (r.stdout || "") + (r.stderr || "") };
}
let fails = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fails++;
};
const read = (dir, p) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), "utf8") : "");
const ld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));

const fx = join(tmp, "out-fixture");
const b1 = build(["--data", data, "--vercel", join(ROOT, "test/fixtures/vercel.fixture.json")], fx);
check("fixture build exits 0", b1.ok);
if (!b1.ok) console.log(b1.log);
const page = read(fx, `games/${classic.slug}/index.html`);
check("classic page exists", page.length > 0);
check('classic page: "Code and art are our own" count = 0', (page.match(/Code and art are our own/g) || []).length === 0);
check("classic page: author credited", page.includes(`Original game by <a href="${classic.authorUrl}" rel="noopener">${classic.author}</a>`));
check("classic page: licence links licenseUrl", page.includes(`href="${classic.licenseUrl}" rel="noopener">MIT</a>`));
check("classic page: copyright notice retained", page.includes(classic.copyrightNotice));
check("classic page: source URL + commit", page.includes(`href="${classic.source}"`) && page.includes(`<code>${classic.sourceCommit}</code>`));
check("classic page: modification notes", page.includes(classic.modifications));
check("classic page: proof quote + checked date", page.includes(classic.licenseEvidence.quote) && page.includes(`datetime="${classic.licenseEvidence.checked}"`));
check("classic page: says not official", /not an official release/.test(page));
check('classic page: fact row "Made by" credits the author', page.includes(`<dt>Made by</dt><dd>${classic.author} (original) · hosted by Toolstack Lab</dd>`));
const game = ld(page).find((j) => [].concat(j["@type"]).includes("VideoGame"));
check(`classic JSON-LD author.name === "${classic.author}"`, game?.author?.name === classic.author && game?.author?.["@type"] === "Person");
check("classic JSON-LD license === licenseUrl", game?.license === classic.licenseUrl);
const about = read(fx, "about/index.html");
check('fixture About: no "Every game is our own"', !about.includes("Every game is our own"));
check('fixture About: "mostly 3D, plus a few selected classics"', about.includes("mostly 3D, plus a few selected classics"));
const home = read(fx, "index.html");
check('fixture home: no "Every game here is made by Toolstack Lab"', !home.includes("Every game here is made by Toolstack Lab"));
check('fixture home: no "Small games made by Toolstack Lab"', !home.includes("Small games made by Toolstack Lab"));
const policy = read(fx, "content-policy/index.html");
check("fixture policy: lists classic with licence link + notice", policy.includes(`href="${classic.licenseUrl}" rel="noopener">MIT</a> · ${classic.copyrightNotice}`));
const spud = read(fx, "games/spud-fling/index.html");
check("fixture spud page keeps self-made credits", spud.includes("Original game by Toolstack Lab. Code and art are our own. All rights reserved."));
check("fixture spud JSON-LD author is the Organization", ld(spud).find((j) => [].concat(j["@type"]).includes("VideoGame"))?.author?.["@type"] === "Organization");

check("fixture classic iframe is sandboxed (scripts, same-origin, pointer-lock only)", iframeTag(page).includes(SANDBOX));
check("fixture classic iframe src empty until Play", !/\ssrc="/.test(iframeTag(page)));
check("fixture spud iframe has no sandbox", iframeTag(spud) !== "" && !iframeTag(spud).includes("sandbox"));
check("fixture home: Classics shelf + #classics-grid", home.includes('id="classics-h">Classics</h2>') && home.includes('id="classics-grid"'));

const pr = join(tmp, "out-prod");
const b2 = build([], pr);
check("production-data build exits 0", b2.ok);
const pAbout = read(pr, "about/index.html");
const pHome = read(pr, "index.html");
check('prod About: no "Every game is our own" (a classic is listed)', !pAbout.includes("Every game is our own"));
check("prod About + home use the mixed wording", pAbout.includes("mostly 3D, plus a few selected classics") && pHome.includes("mostly 3D, plus a few selected classics"));
check("prod home: Classics shelf lists Merge Tiles", pHome.includes('id="classics-grid"') && /id="classics"[\s\S]*href="\/games\/merge-tiles\/"/.test(pHome));
const pMerge = read(pr, "games/merge-tiles/index.html");
check("prod merge-tiles iframe sandboxed", iframeTag(pMerge).includes(SANDBOX));
check('prod merge-tiles credits "Gabriele Cirulli et al." + MIT', pMerge.includes("Gabriele Cirulli et al.") && pMerge.includes(">MIT</a>"));
check("prod spud + pips iframes have no sandbox", ["spud-fling", "pips-bloom-isle"].every((sl) => !iframeTag(read(pr, `games/${sl}/index.html`)).includes("sandbox")));
check("prod build has no fixture slug", !existsSync(join(pr, "games", classic.slug)) && !read(pr, "sitemap.xml").includes(classic.slug));

// H-05: every game page's facts <dl> has a one-line Controls row and a Licence row linking games.json licenseUrl
const factsOf = (html) => (html.match(/<dl class="facts">([\s\S]*?)<\/dl>/) || ["", ""])[1];
for (const g of real) {
  const f = factsOf(read(pr, `games/${g.slug}/index.html`));
  check(`H-05 ${g.slug}: facts Controls row`, /<dt>Controls<\/dt><dd>[^<]+<\/dd>/.test(f));
  check(`H-05 ${g.slug}: facts Licence row links licenseUrl`, f.includes(`<dt>Licence</dt><dd><a href="${g.licenseUrl}"`));
}

// H-06: Unlocks and goals (games with goals) and How we made it (games with howWeMade), measured values only
const section = (html, h) => { const i = html.indexOf(`>${h}</h2>`); return i < 0 ? "" : html.slice(i, html.indexOf("</section>", i)); };
for (const g of real) {
  const html = read(pr, `games/${g.slug}/index.html`);
  if (g.goals) {
    const sec = section(html, "Unlocks and goals");
    check(`H-06 ${g.slug}: H2 "Unlocks and goals"`, sec !== "");
    check(`H-06 ${g.slug}: every goal name + threshold shown`, g.goals.every((x) => sec.includes(x.name) && sec.includes(x.threshold.toLocaleString("en-US"))));
  }
  if (g.howWeMade) {
    const sec = section(html, "How we made it");
    check(`H-06 ${g.slug}: H2 "How we made it" with the text`, sec.includes(g.howWeMade.replaceAll("'", "&#39;")));
    const nulls = (g.testNotes || []).filter((n) => n.value == null).length;
    check(`H-06 ${g.slug}: "No data yet" exactly once per unmeasured note (${nulls})`, (html.match(/No data yet/g) || []).length === nulls);
  }
}

// H-07: About lists "Games we make" (title as anchor text); home, popular and About link every game; every
// /content-policy/#slug link on any built page resolves to an id on the policy page
const aboutList = (pAbout.split(">Games we make</h2>")[1] || "").split("</ul>")[0];
for (const g of real.filter((x) => x.license === "self-made"))
  check(`H-07 About "Games we make" links ${g.slug} with its title`, aboutList.includes(`<a href="/games/${g.slug}/">${g.title.replaceAll("'", "&#39;")}</a>`));
for (const [name, html] of [["home", pHome], ["popular", read(pr, "popular/index.html")], ["about", pAbout]])
  check(`H-07 ${name} links every game page`, real.every((g) => html.includes(`href="/games/${g.slug}/"`)));
const policyIds = new Set([...read(pr, "content-policy/index.html").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const pages = ["index.html", "popular/index.html", "about/index.html", "content-policy/index.html", ...real.map((g) => `games/${g.slug}/index.html`)];
const anchors = pages.flatMap((p) => [...read(pr, p).matchAll(/href="(?:https:\/\/games\.gettoolstacklab\.com)?\/content-policy\/#([^"]+)"/g)].map((m) => m[1]));
check(`H-07 every /content-policy/#slug link resolves (${anchors.length} links)`, anchors.length > 0 && anchors.every((a) => policyIds.has(a)));

const ow = join(tmp, "out-own");
const b3 = build(["--data", ownData], ow);
check("own-games-only build exits 0", b3.ok);
const oAbout = read(ow, "about/index.html");
const oHome = read(ow, "index.html");
check('own-only About still says "Every game is our own"', oAbout.includes("Every game is our own"));
check("own-only pages never mention classics", !/selected classics/.test(oAbout + oHome) && !oHome.includes('id="classics"'));
check("own-only: no sandbox on any iframe", !/sandbox=/.test(read(ow, "games/spud-fling/index.html") + read(ow, "games/pips-bloom-isle/index.html")));
check("dist/ untouched by fixture build", !existsSync(join(ROOT, "dist/games", classic.slug)));
console.log(`\n${fails ? "FAIL" : "PASS"}: ${fails} failed assertion(s); output in ${tmp}`);
process.exit(fails ? 1 : 0);
