#!/usr/bin/env node
/**
 * Static site builder for Toolstack Lab game hub.
 * Reads data/games.json + data/stats.json → dist/
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
/* CLI (defaults = production build): node build.mjs [--data games.json] [--stats stats.json] [--vercel vercel.json] [--out dir]
   The overrides exist for fixture builds (test/build-fixture.mjs); never point --out at dist/ with fixture data. */
const ARGS = (() => {
  const a = {};
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i += 2) {
    const k = v[i].replace(/^--/, "");
    if (!["data", "stats", "vercel", "out"].includes(k) || v[i + 1] === undefined) {
      console.error(`usage: node build.mjs [--data f] [--stats f] [--vercel f] [--out dir] (bad arg ${v[i]})`);
      process.exit(2);
    }
    a[k] = resolve(v[i + 1]);
  }
  return a;
})();
const DATA = ARGS.data || resolve(ROOT, "data/games.json");
const STATS = ARGS.stats || resolve(ROOT, "data/stats.json");
const VERCEL = ARGS.vercel || resolve(ROOT, "vercel.json");
const DIST = ARGS.out || resolve(ROOT, "dist");
const CANONICAL = "https://games.gettoolstacklab.com";
const SITE_NAME = "Toolstack Lab Games";
const BUILD_DATE = "2026-10-30";
const ORG = { "@type": "Organization", name: "Toolstack Lab", url: "https://gettoolstacklab.com" };
const MAX_TAGS = 3;
const SEARCH_MIN_GAMES = 6;
/* H-02: authorship copy is driven by data. While every game is self-made the site says so; once a
   clearly-licensed open-source classic is listed, the copy switches to the Lead-decided wording
   ("mostly 3D, plus a few selected classics") and each classic is credited on its own page. */
const isSelfMade = (g) => g.license === "self-made";
const MIX_PHRASE = "mostly 3D, plus a few selected classics";
/* Home <title>/og/twitter/CollectionPage name when a classic is listed (seo.home-mix). */
const HOME_NAME_MIX = "Free 3D Browser Games + Classics";
const allOwn = (games) => games.every(isSelfMade);
/* R12: how many games are ours, said from the data ("Most" only while it is true). */
const NUM_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const numWord = (k) => NUM_WORDS[k] || String(k);
const ownShare = (games) => {
  const own = games.filter(isSelfMade).length;
  return own * 2 > games.length ? "Most" : `${numWord(own)} of the ${numWord(games.length).toLowerCase()}`;
};
/* R12: no "desktop or phone" promise in site-wide copy while a desktop-first game is listed. */
const anyDesktopFirst = (games) => games.some((g) => g.platform === "desktop-first");
const playWhere = (games) => (anyDesktopFirst(games) ? "Play in your browser" : "Play instantly on desktop or phone");
/* H-09: home shelves. A third-party game sits on the Classics shelf unless its data says otherwise;
   with no classic listed the home page renders exactly one "All games" shelf, as before. */
const isClassic = (g) => (g.shelf || (isSelfMade(g) ? "3d" : "classics")) === "classics";
/* H-09: a game we do not make runs in a sandboxed frame (scripts + its own origin's storage + pointer lock;
   no top navigation, popups, forms or downloads). Own games keep their unsandboxed frame. */
const SANDBOX_THIRD_PARTY = "allow-scripts allow-same-origin allow-pointer-lock";
/* Classics load with ?internal=1 and send no beacon, so they never get a visit count.
   Say so wherever a ranking or a classic's own page would otherwise imply every game is counted. */
const VISIT_SCOPE = "Visit counts cover Toolstack Lab's own games only.";
const hasUncounted = (games) => games.some((g) => !isSelfMade(g));
const tagline = (games) =>
  allOwn(games)
    ? "Small games made by Toolstack Lab. Click Play and you are in — no download, no account, no cookies."
    : `Small browser games, ${MIX_PHRASE}. Click Play and you are in — no download, no account, no cookies.`;
const homeDesc = (games) =>
  allOwn(games)
    ? "Free 3D browser games by Toolstack Lab: a one-button potato slingshot and a cozy island platformer. Play instantly on desktop or phone. No download, no account."
    : `Free browser games from Toolstack Lab, ${MIX_PHRASE}. ${playWhere(games)}, with no download, no account and no cookies.`;
/* Popular meta description: names every game while that fits in 160 characters, else gives the count. */
const popularDesc = (games) => {
  const tail = anyDesktopFirst(games) ? "No download, no account." : "Play instantly on desktop or phone, no account.";
  const named = `All free browser games on Toolstack Lab, most visited first: ${listNames(games.map((g) => g.title))}. ${tail}`;
  return named.length <= 160 ? named : `All ${games.length} free browser games on Toolstack Lab, most visited first. ${tail}`;
};
/* JSON-LD author: the Organization for our own games; the credited upstream author for a classic. */
const listNames = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const authorLd = (g) =>
  isSelfMade(g) ? ORG : { "@type": "Person", name: g.author, ...(g.authorUrl ? { url: g.authorUrl } : {}) };

function creditsBlock(g, updated) {
  if (isSelfMade(g)) {
    return `<p>Original game by ${esc(g.author)}. Code and art are our own. All rights reserved.</p>
    <dl>
      <div><dt>Licence</dt><dd><a class="hit" href="/content-policy/#${esc(g.slug)}">Self-made · content policy</a></dd></div>
      <div><dt>Source</dt><dd>${esc(g.source)}</dd></div>
      <div><dt>Checked</dt><dd><time datetime="${esc(updated)}">${esc(updated)}</time></dd></div>
    </dl>`;
  }
  const ev = g.licenseEvidence || {};
  const author = g.authorUrl ? `<a href="${esc(g.authorUrl)}" rel="noopener">${esc(g.author)}</a>` : esc(g.author);
  const src = `<a href="${esc(g.source)}" rel="noopener">${esc(g.source.replace(/^https:\/\//, ""))}</a>${g.sourceCommit ? ` at <code>${esc(g.sourceCommit)}</code>` : ""}`;
  return `<p>Original game by ${author}, used under the ${esc(g.license)} licence. Toolstack Lab hosts a copy on its own web address; it is not an official release and is not endorsed by the author.</p>
    <dl>
      <div><dt>Licence</dt><dd><a class="hit" href="${esc(g.licenseUrl)}" rel="noopener">${esc(g.license)}</a></dd></div>
      ${g.copyrightNotice ? `<div><dt>Copyright</dt><dd>${esc(g.copyrightNotice)}</dd></div>` : ""}
      <div><dt>Source</dt><dd>${src}</dd></div>
      ${g.lineage ? `<div><dt>Based on</dt><dd>${esc(g.lineage)}</dd></div>` : ""}
      <div><dt>Our changes</dt><dd>${esc(g.modifications)}</dd></div>
      <div><dt>Licence proof</dt><dd><a href="${esc(ev.url)}" rel="noopener">licence text</a>: “${esc(ev.quote)}”</dd></div>
      <div><dt>Checked</dt><dd><time datetime="${esc(ev.checked)}">${esc(ev.checked)}</time></dd></div>
    </dl>`;
}

/* H-06: first-hand sections, rendered only when games.json has the data. Thresholds come from the game's own
   unlock config; testNotes with value null render as "No data yet" (we never fill in unmeasured numbers). */
function goalsBlock(g) {
  if (!g.goals || !g.goals.length) return "";
  const rows = g.goals
    .map((x) => `<tr><th scope="row">${esc(x.name)}</th><td>${esc(x.threshold.toLocaleString("en-US"))}</td><td>${esc(x.effect || "")}</td></tr>`)
    .join("");
  return `<section class="goals" aria-labelledby="goals-h">
    <h2 id="goals-h">Unlocks and goals</h2>
    ${g.goalsIntro ? `<p>${esc(g.goalsIntro)}</p>` : ""}
    <div class="table-wrap"><table class="goals-table">
      <thead><tr><th scope="col">Unlock</th><th scope="col">Coins needed</th><th scope="col">What it adds</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    </section>`;
}

function madeBlock(g) {
  /* Round 12: a game we did not make never gets "How we made it" (validate.mjs forbids howWeMade there);
     its own measured facts render as "What we measured", same rows and same "No data yet" rule. */
  const measuredOnly = !isSelfMade(g) && !g.howWeMade && (g.testNotes || []).length > 0;
  if (!g.howWeMade && !measuredOnly) return "";
  const notes = (g.testNotes || [])
    .map((n) => `<div><dt>${esc(n.label)}</dt><dd${n.value == null ? ' class="nodata">No data yet' : `>${esc(n.value)}`}</dd></div>`)
    .join("");
  return `<section class="made" aria-labelledby="made-h">
    <h2 id="made-h">${measuredOnly ? "What we measured" : "How we made it"}</h2>
    <p>${measuredOnly ? "We did not make this game. These are the checks we ran on the copy we host, and the gaps we have not measured yet." : esc(g.howWeMade)}</p>
    ${notes ? `<dl class="facts made-notes">${notes}</dl>
    <p class="made-foot">We only list numbers we have measured ourselves; the empty rows get filled in once we have real ones.</p>` : ""}
    </section>`;
}

/* Round 12: data-driven platform label (validate.mjs: platform "desktop-first" needs platformNote) and
   hard requirements such as WebGL2; nothing renders for games without the fields. */
const desktopFirst = (g) => g.platform === "desktop-first" && !!g.platformNote;
function platformNoteHtml(g) {
  if (!desktopFirst(g) && !(g.requires || []).length) return "";
  const req = (g.requires || []).map((r) => ` <span class="platform-req">${esc(r.note)}</span>`).join("");
  return `<p class="platform-note" role="note">${desktopFirst(g) ? `<strong>Desktop first.</strong> ${esc(g.platformNote)}` : ""}${req}</p>`;
}

function tagsHtml(g) {
  return `<div class="tags">${(g.tags || []).slice(0, MAX_TAGS).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;
}

function score(stats, slug) {
  const s = stats[slug] || { visits: 0, plays: 0 };
  return (Number(s.plays) || 0) * 3 + (Number(s.visits) || 0);
}

/* Honest heat label: visits until real plays exist (no misleading "0 plays") */
function heat(stats, slug) {
  const s = stats[slug] || { visits: 0, plays: 0 };
  const plays = Number(s.plays) || 0;
  const visits = Number(s.visits) || 0;
  if (plays > 0) return { n: score(stats, slug), unit: "score", title: "score = plays×3 + visits" };
  return { n: visits, unit: "visits", title: "external visits, last 14 days" };
}

/* "New" instead of "0 visits": no visit or play data yet AND listed under NEW_DAYS days before the build date.
   Data-driven: as soon as stats.json has visits for the game, or it is older, the real count shows. */
const NEW_DAYS = 14;
function isNew(stats, g) {
  const s = stats[g.slug] || {};
  if ((Number(s.visits) || 0) > 0 || (Number(s.plays) || 0) > 0) return false;
  const days = (Date.parse(BUILD_DATE) - Date.parse(g.added || "")) / 864e5;
  return days >= 0 && days < NEW_DAYS;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Visible date: U+2011 non-breaking hyphens so "2026-10-30" cannot wrap as "2026-10-" / "30".
   The datetime attribute stays ASCII (callers pass esc(iso) there, not nbDate). */
function nbDate(iso) {
  return esc(iso).replaceAll("-", "&#8209;");
}

// Hub iframe URL = the game's url + its games.json `embedQuery` (validate.mjs allows only "src=hub" or "internal=1").
//   src=hub    the game counts the play with its own cookie-free Web Analytics tag (marker tells hub plays apart in the URL)
//   internal=1 the game skips its own tag: another beacon already counts it (Pip: the zone beacon) or nothing should
function embedUrl(url, query) {
  const params = new URLSearchParams(query || "internal=1");
  try {
    const u = new URL(url);
    for (const [k, v] of params) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + params.toString();
  }
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function write(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

function assetPath(p) {
  return "/" + String(p).replace(/^\/+/, "");
}

function webpOf(p) {
  return p.replace(/\.jpe?g$/i, ".webp");
}

function layout({
  title,
  description,
  canonicalPath,
  ogImage,
  body,
  jsonLd,
  extraHead = "",
  navActive = "",
  ogAlt = "Toolstack Lab Games – free 3D browser games",
  ogW = 1200,
  ogH = 630,
}) {
  const canon = `${CANONICAL}${canonicalPath}`;
  const og = ogImage.startsWith("http")
    ? ogImage
    : `${CANONICAL}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;

  const nav = [
    { href: "/#games", id: "games", label: "Games" },
    { href: "/popular/", id: "popular", label: "Popular" },
    { href: "/about/", id: "about", label: "About" },
  ]
    .map((n) => {
      const cur = n.id === navActive ? ' aria-current="page"' : "";
      return `<a href="${n.href}"${cur}>${n.label}</a>`;
    })
    .join("\n      ");

  const ldBlocks = Array.isArray(jsonLd)
    ? jsonLd
        .filter(Boolean)
        .map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`)
        .join("\n")
    : jsonLd
      ? `<script type="application/ld+json">${typeof jsonLd === "string" ? jsonLd : JSON.stringify(jsonLd)}</script>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canon)}">
<meta name="theme-color" content="#0e1218" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f4f6fa" media="(prefers-color-scheme: light)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(og)}">
<meta name="twitter:image:alt" content="${esc(ogAlt)}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="preload" href="/assets/fonts/space-grotesk-display.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
${extraHead}
${ldBlocks}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap inner">
    <a class="brand" href="/">
      <span class="brand-name">Toolstack Lab</span>
      <span class="brand-sub">Games</span>
    </a>
    <nav class="nav" aria-label="Primary">
      ${nav}
    </nav>
  </div>
</header>
${body}
<footer class="site-footer">
  <div class="wrap inner">
    <div class="copy">© Toolstack Lab · browser games, self-hosted · no ads, no cookies · cookie-free visit counting only</div>
    <nav class="links" aria-label="Footer">
      <a href="/about/">About</a>
      <a href="/popular/">All games</a>
      <a href="/content-policy/">Content policy</a>
      <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>
    </nav>
  </div>
  <!-- polish-r5 -->
</footer>
<div id="toast-host" class="toast-host" aria-live="polite"></div>
<script src="/site.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;
}

// R5: cache-bust site.css/js (served with a 1-day cache) so new HTML never pairs with stale CSS
const ASSET_V = createHash("sha256")
  .update(readFileSync(resolve(ROOT, "src/site.css")))
  .update(readFileSync(resolve(ROOT, "src/site.js")))
  .digest("hex")
  .slice(0, 10);

const PLAY_ICON = '<span class="play-icon" aria-hidden="true"></span>';

/* R4: one "how it works" bay diagram, reused on home (hero side) and About (side column). Pure HTML/CSS. */
function howItWorks(games, { heading = "How it plays", id = "how-h" } = {}) {
  return `<aside class="howto" aria-labelledby="${id}">
  <div class="howto-bar"><span class="bay-led" aria-hidden="true"></span><h2 id="${id}">${esc(heading)}</h2></div>
  <ol class="howto-steps">
    <li><span class="howto-n" aria-hidden="true">1</span><span><strong>Pick a cartridge.</strong> Each game is one card: a real in-game frame, a short pitch, three tags.</span></li>
    <li><span class="howto-n" aria-hidden="true">2</span><span><strong>Press Play.</strong> The game docks into the play bay on its page and starts loading at once.</span></li>
    <li><span class="howto-n" aria-hidden="true">3</span><span><strong>Play in the page.</strong> Nothing to install. Progress stays in your own browser.</span></li>
  </ol>
  <ul class="howto-facts" aria-label="At a glance">
    <li><strong>${games.length}</strong> games</li>
    <li><strong>Free</strong> to play</li>
    <li><strong>No</strong> account</li>
    <li><strong>No</strong> cookies</li>
  </ul>
</aside>`;
}

function allTags(games) {
  const set = new Set();
  for (const g of games) for (const t of g.tags || []) set.add(t);
  return [...set].sort();
}

function cardHtml(g, stats, { featured = false, index = 0 } = {}) {
  const ht = heat(stats, g.slug);
  const thumb = assetPath(g.thumbnail);
  const thumbWebp = webpOf(thumb);
  const shots = (g.screenshots || []).map(assetPath);
  const preview = shots[1] || shots[0] || thumb;
  const previewWebp = webpOf(preview);
  const searchHay = [g.title, g.pitch, g.description, ...(g.tags || [])].join(" ");

  return `<article class="card${featured ? " card-featured" : ""}" data-tags="${esc((g.tags || []).join(" "))}" data-search="${esc(searchHay)}" tabindex="0">
  <a class="card-thumb" href="/games/${esc(g.slug)}/" aria-label="${esc(g.title)}">
    <picture>
      <source type="image/webp" srcset="${esc(thumbWebp)}">
      <img src="${esc(thumb)}" alt="" width="640" height="360" loading="${featured ? "eager" : "lazy"}" decoding="async"${featured ? ' fetchpriority="high"' : ""}>
    </picture>
    <picture class="preview-layer" aria-hidden="true">
      <source type="image/webp" srcset="${esc(previewWebp)}">
      <img src="${esc(preview)}" alt="" width="640" height="360" loading="lazy" decoding="async">
    </picture>
  </a>
  <div class="card-body">
    <div class="cart-plate"><span class="cart-serial" aria-hidden="true">TSL·${String(index + 1).padStart(2, "0")}</span>${featured ? '<span class="cart-badge">Most visited</span>' : ""}${desktopFirst(g) ? `<span class="card-platform" title="${esc(g.platformNote)}">Desktop first</span>` : ""}</div>
    <h2 class="card-title"><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a></h2>
    <p class="card-pitch">${esc(g.pitch)}</p>
    ${tagsHtml(g)}
    <div class="card-actions">
      <a class="btn btn-play" href="/games/${esc(g.slug)}/#play" data-recent-slug="${esc(g.slug)}" data-recent-title="${esc(g.title)}">${PLAY_ICON}Play<span class="visually-hidden"> ${esc(g.title)}</span></a>
      ${isNew(stats, g) ? `<span class="card-score card-new" title="Added ${esc(g.added)}; no visit data yet">New</span>` : `<span class="card-score"><span data-count-to="${ht.n}">${ht.n}</span> ${ht.unit === "visits" ? "visits · 14 days" : "plays"}</span>`}
    </div>
  </div>
</article>`;
}

function homePage(games, stats) {
  const tags = allTags(games);
  const hot = games[0];
  const rest = games.slice(1);

  // R3: one card design for every game (no separate featured slot) — same text sizes, same actions
  // H-09: classics get their own shelf; serials (TSL·NN) keep the site-wide order
  const classics = games.filter(isClassic);
  const mainShelf = classics.length ? games.filter((g) => !isClassic(g)) : games;
  const cardOf = (g) => cardHtml(g, stats, { featured: g === games[0], index: games.indexOf(g) });
  const cards = mainShelf.map(cardOf).join("\n");
  const cardCount = mainShelf.length;

  const tagBtns = [
    `<button type="button" data-filter-tag="all" aria-pressed="true">All</button>`,
    ...tags.map(
      (t) =>
        `<button type="button" data-filter-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`
    ),
  ].join("\n        ");

  const body = `
<main id="main">
  <section class="hero hero-split wrap">
    <div class="hero-text">
      <div class="hero-kicker">Toolstack Lab Games</div>
      <h1>${classics.length ? "Free 3D browser games and classics – play instantly" : "Free 3D browser games – play instantly, no account"}</h1>
      <p>${esc(tagline(games))}</p>
      <div class="hero-actions">
        <a class="btn btn-play btn-lg" href="/games/${esc(hot.slug)}/#play" data-recent-slug="${esc(hot.slug)}" data-recent-title="${esc(hot.title)}">${PLAY_ICON}Play ${esc(hot.title)}</a>
        <a class="btn-link" href="#games">See all ${games.length} games</a>
      </div>
    </div>
    ${howItWorks(games)}
  </section>
  <section class="section wrap" id="games">
    <div class="section-head">
      <h2>${classics.length ? "3D games" : "All games"}</h2>
      <a class="section-link" href="/popular/">See the list</a>
    </div>
    ${games.length >= SEARCH_MIN_GAMES ? `<div class="toolbar">
      <div class="search-wrap">
        <label for="game-search">Search games</label>
        <span class="search-icon" aria-hidden="true">/</span>
        <input id="game-search" type="search" placeholder="Search title, tag, pitch…" autocomplete="off" enterkeyhint="search">
      </div>
      ${games.length > 4 ? `<div class="tag-filters" role="group" aria-label="Filter by tag">
        ${tagBtns}
      </div>` : ""}
    </div>
    <p class="filter-hint hint-fine">Tip: <span class="kbd">/</span> focuses search · <span class="kbd">Enter</span> plays the focused cartridge</p>` : ""}
    <div class="grid${cardCount <= 6 ? " stagger" : ""}" id="games-grid">
${cards}
    </div>
    <p class="empty-filter" id="filter-empty" hidden>No cartridges match that filter.</p>
    <aside class="recent" id="recent-played" hidden>
      <h2>Recently played on this device</h2>
      <ul></ul>
    </aside>
  </section>${classics.length ? `
  <section class="section wrap" id="classics" aria-labelledby="classics-h">
    <div class="section-head">
      <h2 id="classics-h">Classics</h2>
    </div>
    <p class="shelf-note">A few selected open-source games by other authors, credited on each game page. They run on a separate web address in a sandboxed frame.${hasUncounted(games) ? ` ${VISIT_SCOPE}` : ""}</p>
    <div class="grid${classics.length <= 6 ? " stagger" : ""}" id="classics-grid">
${classics.map(cardOf).join("\n")}
    </div>
  </section>` : ""}
  <section class="section wrap safe-note" aria-labelledby="safe-h">
    <h2 id="safe-h">Why these games are safe to play</h2>
    <p>${allOwn(games) ? "Every game here is made by Toolstack Lab." : `${ownShare(games)} games here are made by Toolstack Lab; the few selected classics are open-source games credited to their authors.`} There is no sign-up. No ads, no cookies, no scripts that track individuals; we only use cookie-free visit counting. Progress stays in your own browser. Each game page lists its licence, and the <a href="/content-policy/">content policy</a> explains what may be listed.</p>
  </section>
</main>`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "All games",
    url: CANONICAL + "/",
    numberOfItems: games.length,
    itemListElement: games.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${CANONICAL}/games/${g.slug}/`,
      name: g.title,
      item: {
        "@type": "VideoGame",
        name: g.title,
        url: `${CANONICAL}/games/${g.slug}/`,
      },
    })),
  };

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: classics.length ? HOME_NAME_MIX : SITE_NAME,
    description: homeDesc(games),
    url: CANONICAL + "/",
    inLanguage: "en",
    isPartOf: { "@id": CANONICAL + "/#website" },
    mainEntity: { "@id": CANONICAL + "/#itemlist" },
  };
  itemList["@id"] = CANONICAL + "/#itemlist";
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": CANONICAL + "/#website",
    name: SITE_NAME,
    url: CANONICAL + "/",
    inLanguage: "en",
    publisher: { "@id": "https://gettoolstacklab.com/#org" },
  };
  const org = { "@context": "https://schema.org", ...ORG, "@id": "https://gettoolstacklab.com/#org" };

  return layout({
    title: classics.length ? `${HOME_NAME_MIX} | ${SITE_NAME}` : "Free 3D Browser Games: No Download, No Login | Toolstack Lab",
    description: homeDesc(games),
    canonicalPath: "/",
    ogImage: "/og.jpg",
    body,
    jsonLd: [website, org, collection, itemList],
    navActive: "games",
  });
}

function similarBlock(g, allGames) {
  const others = allGames.filter((x) => x.slug !== g.slug);
  const sg = g.similarGenres || [];
  const genres = sg.length
    ? `<p class="similar-prose">If you like ${esc(g.title)}, the closest genres are ${sg
        .map((x) => `<strong>${esc(x.genre.toLowerCase())}</strong>`)
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1")}. These are genre pointers, not other studios’ games.</p>`
    : "";

  const hubCarts =
    others.length > 0
      ? `<div class="similar-carts">${others
          .map(
            (o, i) => `<a class="similar-cart" href="/games/${esc(o.slug)}/">
  <span class="similar-thumb"><picture><source type="image/webp" srcset="${esc(webpOf(assetPath(o.thumbnail)))}"><img src="${esc(assetPath(o.thumbnail))}" alt="" width="640" height="360" loading="lazy" decoding="async"></picture></span>
  <span class="cart-serial">TSL·${String(allGames.indexOf(o) + 1).padStart(2, "0")}</span>
  <strong>${esc(o.title)}</strong>
  <span class="muted">${esc(o.pitch)}</span>
</a>`
          )
          .join("")}</div>`
      : "";

  return `<section class="prose similar" aria-labelledby="similar-h">
  <h2 id="similar-h">More games on Toolstack Lab</h2>
  ${hubCarts}
  ${genres}
</section>`;
}

function faqBlock(g) {
  const faqs = g.faq || [];
  if (!faqs.length) return "";
  const items = faqs
    .map(
      (f) => `<details>
  <summary>${esc(f.q)}</summary>
  <p>${esc(f.a)}</p>
</details>`
    )
    .join("\n");
  return `<section class="prose faq" aria-labelledby="faq-h">
  <h2 id="faq-h">FAQ</h2>
  ${items}
</section>`;
}

function detailPage(g, stats, allGames) {
  const sc = score(stats, g.slug);
  const thumb = assetPath(g.thumbnail);
  const shots = (g.screenshots || [])
    .map((s, i) => {
      const src = assetPath(s);
      const webp = webpOf(src);
      const alt = (g.screenshotAlts && g.screenshotAlts[i]) || `${g.title} screenshot ${i + 1}`;
      return `<figure class="shot-slot">
  <img class="lqip" src="${esc(src.replace(/\.jpe?g$/i, "-lqip.jpg"))}" alt="" width="32" height="18" aria-hidden="true">
  <picture>
    <source type="image/webp" srcset="${esc(webp)}">
    <img src="${esc(src)}" alt="${esc(alt)}" width="1280" height="720" loading="lazy" decoding="async">
  </picture>
  <figcaption>${esc(alt)}</figcaption>
</figure>`;
    })
    .join("\n");

  const tips = (g.tips || [])
    .map((t) => `<li>${esc(t)}</li>`)
    .join("\n");

  const how = g.howToPlay || g.description;
  const kb = g.controlsKeyboard || g.controls;
  const touch = g.controlsTouch || g.controls;

  const cover = assetPath(g.cover || g.thumbnail);
  const coverDir = cover.replace(/\/[^/]+$/, "");
  const policyUrl = `${CANONICAL}/content-policy/#${g.slug}`;
  const updated = g.updated || BUILD_DATE;
  const videoGameLd = {
    "@context": "https://schema.org",
    "@type": ["VideoGame", "WebApplication"],
    "@id": `${CANONICAL}/games/${g.slug}/#game`,
    name: g.title,
    description: how,
    url: `${CANONICAL}/games/${g.slug}/`,
    image: [`${CANONICAL}${coverDir}/cover-1920x1080.jpg`, `${CANONICAL}${coverDir}/cover-800x800.jpg`, `${CANONICAL}${coverDir}/og.jpg`],
    screenshot: (g.screenshots || []).map((x) => CANONICAL + assetPath(x)),
    applicationCategory: "GameApplication",
    operatingSystem: "Web browser",
    gamePlatform: "Web browser",
    playMode: g.playMode || "SinglePlayer",
    genre: g.tags,
    inLanguage: g.inLanguage || "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: authorLd(g),
    publisher: ORG,
    ...((g.requires || []).length ? { softwareRequirements: g.requires.map((r) => r.name).join(", ") } : {}),
    license: g.licenseUrl || policyUrl,
    datePublished: g.added,
    dateModified: updated,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Games",
        item: CANONICAL + "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: g.title,
        item: `${CANONICAL}/games/${g.slug}/`,
      },
    ],
  };

  const faqLd =
    g.faq && g.faq.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: g.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const pageTitle = g.seoTitle || `${g.title} | Toolstack Lab`;
  const pageDesc = g.seoDescription || g.pitch;
  const facts = [
    ["Genre", g.genreLabel || (g.tags || []).slice(0, 2).join(", ")],
    ["Platforms", desktopFirst(g) ? "Web browser – best on a desktop or laptop with a keyboard" : "Web browser – desktop and mobile"],
    ...(g.requires || []).map((r) => ["Needs", r.name]),
    ["Price", "Free"],
    ["Account needed", "No"],
    ["Save data", "Stays in your browser (localStorage)"],
    ["Made by", isSelfMade(g) ? "Toolstack Lab" : `${g.author} (original) · hosted by Toolstack Lab`],
    ["Released", g.added],
    ["Updated", updated],
    // H-05: one-line controls and a licence link, so the key facts sit in one place
    ["Controls", g.controlsShort || g.controls],
    ["Licence", { html: `<a href="${esc(g.licenseUrl)}"${isSelfMade(g) ? "" : ' rel="noopener"'}>${isSelfMade(g) ? "Our own work · all rights reserved" : esc(g.license)}</a>` }],
  ]
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${typeof v === "object" ? v.html : k === "Updated" || k === "Released" ? `<time datetime="${esc(v)}">${nbDate(v)}</time>` : esc(v)}</dd></div>`)
    .join("");

  const body = `
<main id="main" class="wrap">
  <p class="crumb"><a href="/">Games</a> / ${esc(g.title)}</p>
  <div class="detail-hero detail-hero-text">
    <div class="detail-meta">
      <div class="detail-head">
      <h1>${esc(g.title)}</h1>
      <p class="pitch">${esc(g.subline || g.pitch)}</p>
      ${platformNoteHtml(g)}
      ${tagsHtml(g)}
      <p class="score-hint">${isNew(stats, g) ? `<span class="new-pill">New</span> Added <time datetime="${esc(g.added)}">${nbDate(g.added)}</time>; no visit data yet` : heat(stats, g.slug).unit === "visits" ? `<span data-count-to="${heat(stats, g.slug).n}">${heat(stats, g.slug).n}</span> visits in the last 14 days` : `<span data-count-to="${Number((stats[g.slug] || {}).plays) || 0}">${Number((stats[g.slug] || {}).plays) || 0}</span> plays in the last 14 days`}<span class="score-updated">Updated <time datetime="${esc(updated)}">${nbDate(updated)}</time></span></p>
      ${isSelfMade(g) ? "" : `<p class="score-scope">${VISIT_SCOPE}</p>`}
      </div>
      <div class="detail-cta">
      <div class="card-actions detail-actions">
        <button type="button" class="btn btn-play btn-lg" id="play-embed"
          data-game-url="${esc(embedUrl(g.url, g.embedQuery))}"
          data-game-slug="${esc(g.slug)}"
          data-game-title="${esc(g.title)}">${PLAY_ICON}Play</button>
        <button type="button" class="btn btn-ghost" data-share-url="${esc(CANONICAL + "/games/" + g.slug + "/")}" data-share-title="${esc(g.title)}"><span class="lbl-idle">Copy link</span><span class="lbl-done" aria-hidden="true">Copied ✓</span></button>
        <a class="btn-link btn-newtab" href="${esc(g.url)}" target="_blank" rel="noopener"><span class="nt-long">Open in </span>new tab <span aria-hidden="true">↗</span></a>
        <span class="visually-hidden" data-copy-live aria-live="polite"></span>
      </div>
      </div>
    </div>
  </div>

  <section class="play-panel" id="play" aria-label="Play bay">
    <div class="play-bar">
      <span class="bay-led" aria-hidden="true"></span>
      <span class="bay-label">Play bay</span>
      <span class="bay-chip cart-serial" aria-hidden="true">TSL·${String(Math.max(0, allGames.indexOf(g)) + 1).padStart(2, "0")}</span>
      <span class="bay-status" id="bay-status" aria-live="polite">Ready · nothing loads until you press Play</span>
      <span class="bay-progress" aria-hidden="true"></span>
    </div>
    <div class="play-frame-wrap" id="play-frame-wrap">
      <div class="play-placeholder" id="play-placeholder">
        <picture class="bay-cover">
          <source media="(max-width: 480px)" srcset="${esc(coverDir)}/cover-800x1200.jpg">
          <source type="image/webp" srcset="${esc(webpOf(thumb))} 640w, ${esc(webpOf(cover))} 1280w" sizes="(min-width: 1200px) 1200px, 100vw">
          <img src="${esc(cover)}" srcset="${esc(thumb)} 640w, ${esc(cover)} 1280w" sizes="(min-width: 1200px) 1200px, 100vw" alt="${esc(g.coverAlt || g.title)}" width="1280" height="720" decoding="async" fetchpriority="high">
        </picture>
        <button type="button" class="btn btn-play bay-play" id="bay-play" aria-label="Play ${esc(g.title)}">${PLAY_ICON}<span>Play</span></button>
      </div>
      <div class="play-skeleton" id="play-skeleton" hidden><span>Docking…</span></div>
      <div class="dock-cart" id="dock-cart" aria-hidden="true"><span class="cart-serial">${esc(g.title)}</span></div>
      <iframe id="game-frame" title="${esc(g.title)}"${isSelfMade(g) ? "" : ` sandbox="${SANDBOX_THIRD_PARTY}"`} allow="fullscreen; gamepad; autoplay" loading="lazy" referrerpolicy="${isSelfMade(g) ? "strict-origin" : "no-referrer"}" hidden></iframe>
    </div>
  </section>

  <div class="detail-cols">
  <div class="detail-main">
  <article class="prose">
    <p class="definition">${esc(g.definition || "")}</p>
    <dl class="facts">${facts}</dl>
    <h2>How to play ${esc(g.title)}</h2>
    <p>${esc(how)}</p>
    <h2>Controls</h2>
    <div class="controls-grid">
      <div class="controls-card">
        <h3>Keyboard</h3>
        <p>${esc(kb)}</p>
      </div>
      <div class="controls-card">
        <h3>Touch</h3>
        <p>${esc(touch)}</p>
      </div>
    </div>
    <h2>Tips for ${esc(g.title)}</h2>
    <ul>
${tips}
    </ul>
    ${goalsBlock(g)}
    <h2>Screenshots</h2>
    <div class="shots">
${shots}
    </div>
    ${madeBlock(g)}
  </article>

  ${faqBlock(g)}
  </div>
  <aside class="detail-side" aria-label="More on this cartridge">
  ${similarBlock(g, allGames)}

  <section class="license-box prose" id="license" aria-labelledby="license-h">
    <h2 id="license-h">Who made ${esc(g.title)} and its licence</h2>
    ${creditsBlock(g, updated)}
  </section>
  </aside>
  </div>
</main>`;

  return layout({
    title: pageTitle,
    description: pageDesc,
    canonicalPath: `/games/${g.slug}/`,
    ogImage: `${coverDir}/og.jpg`,
    ogAlt: g.coverAlt || `${g.title} cover art`,
    body,
    jsonLd: [videoGameLd, breadcrumbLd, faqLd].filter(Boolean),
    navActive: "games",
  });
}

function popularPage(games, stats) {
  const rows = games
    .map((g, i) => {
      const ht = heat(stats, g.slug);
      const st = stats[g.slug] || { visits: 0, plays: 0 };
      return `<a class="board-row" href="/games/${esc(g.slug)}/">
  <div class="board-rank">#${i + 1}</div>
  <div class="board-meta">
    <h2>${esc(g.title)}</h2>
    <p>${esc(g.pitch)}</p>
  </div>
  <div class="board-score">
    ${isNew(stats, g) ? `<div class="board-n">New</div>
    <div>added ${esc(g.added)}</div>` : `<div class="board-n"><span data-count-to="${ht.n}">${ht.n}</span> ${ht.unit === "visits" ? "visits" : "plays"}</div>
    <div>${Number(st.plays) > 0 ? `${Number(st.visits) || 0} visits · ${Number(st.plays)} plays` : "last 14 days"}</div>`}
  </div>
</a>`;
    })
    .join("\n");

  const body = `
<main id="main" class="wrap">
  <section class="page-intro">
    <h1>All games</h1>
    <p>Every game on Toolstack Lab Games, most visited first (external visits over the last 14 days).${hasUncounted(games) ? ` ${VISIT_SCOPE}` : ""} Play counts will appear here once we can measure them.</p>
  </section>
  <section class="section" aria-label="Ranking">
    <div class="board">
${rows}
    </div>
  </section>
</main>`;

  return layout({
    title: "All Games | Toolstack Lab",
    description: allOwn(games)
      ? "All free 3D browser games on Toolstack Lab, most visited first: Spud Fling and Pip's Bloom Isle. Play instantly on desktop or phone, no download or account."
      : popularDesc(games),
    canonicalPath: "/popular/",
    ogImage: "/og.jpg",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "All games",
      url: CANONICAL + "/popular/",
      itemListElement: games.map((g, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${CANONICAL}/games/${g.slug}/`,
        name: g.title,
      })),
    },
    navActive: "popular",
  });
}

function aboutPage(games) {
  const body = `
<main id="main" class="wrap">
  <section class="page-intro">
    <h1>About Toolstack Lab Games</h1>
    <p>${allOwn(games)
      ? "Toolstack Lab Games is where Toolstack Lab publishes the small 3D browser games it makes. Every game is our own; press Play and it loads right in the page."
      : `Toolstack Lab Games is where Toolstack Lab publishes small browser games: ${MIX_PHRASE}. ${ownShare(games)} are our own; each classic is a clearly-licensed open-source game, credited to its author on its page. Press Play and it loads right in the page.`} No accounts, and no third-party scripts or fonts on these pages. No ads, no cookies, no scripts that track individuals; we only use cookie-free visit counting, inside our own games.</p>
  </section>
  <div class="page-cols">
  <article class="prose page-main">
    <h2>What you get</h2>
    <ul>
      <li>${allOwn(games) ? "Games we made ourselves." : "Games we made ourselves, plus a few selected open-source classics."} Each game page shows its licence and source.</li>
      <li>Nothing heavy loads until you press Play. You can also open any game in its own tab.</li>
      <li>The ranking uses visits from the last 14 days.${hasUncounted(games) ? ` ${VISIT_SCOPE}` : ""} “Recently played” stays on your device only.</li>
    </ul>
    <h2>Games we make</h2>
    <ul class="game-list">
${games.filter(isSelfMade).map((g) => `      <li><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a>: ${esc(g.pitch)} <a class="hit" href="/content-policy/#${esc(g.slug)}">Licence and source</a></li>`).join("\n")}
    </ul>${games.some((g) => !isSelfMade(g)) ? `
    <h2>Classics we host</h2>
    <ul class="game-list">
${games.filter((g) => !isSelfMade(g)).map((g) => `      <li><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a>: by ${esc(g.author)}, ${esc(g.license)} licence. <a class="hit" href="/content-policy/#${esc(g.slug)}">Licence and source</a></li>`).join("\n")}
    </ul>` : ""}
    <h2>The lab cartridge idea</h2>
    <p>Every game gets the same cartridge card with a label plate and a serial number (TSL·01, TSL·02…). On a game page, Play docks the cartridge into the play bay. That is the one bit of motion on the site; there are no video or 3D backgrounds.</p>
    <h2>Who the games are for</h2>
    <p>Spud Fling suits anyone who likes quick one-button rounds. Pip's Bloom Isle is aimed at casual players 13+.${games
      .filter((g) => !isSelfMade(g))
      .map((g) => ` <a href="/games/${esc(g.slug)}/">${esc(g.title)}</a> is an open-source classic by ${esc(g.author)}; its page explains how it plays and who made it.`)
      .join("")} We only describe what each build already ships. The <a href="/content-policy/">content policy</a> sets out which games may be listed.</p>
    <h2>Contact</h2>
    <p>Parent site: <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>. The hub's source is public on GitHub as madlouse/toolstack-games.</p>
  </article>
  ${howItWorks(games, { heading: "How the hub works", id: "about-how-h" })}
  </div>
</main>`;

  return layout({
    title: "About Toolstack Lab Games – Who Makes Them & Licences",
    description:
      "Who makes Toolstack Lab Games and how each game is licensed. No ads, no cookies, no scripts that track individuals; only cookie-free visit counting.",
    canonicalPath: "/about/",
    ogImage: "/og.jpg",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About Toolstack Lab Games",
      url: CANONICAL + "/about/",
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", "@id": CANONICAL + "/#website", name: SITE_NAME, url: CANONICAL + "/" },
      publisher: ORG,
    },
    navActive: "about",
  });
}

function notFoundPage() {
  const body = `
<main id="main" class="wrap error-page">
  <div class="bay-empty-404" aria-hidden="true">
    <svg class="bay-graphic" viewBox="0 0 240 120" focusable="false">
      <rect class="bay-slot" x="40" y="22" width="160" height="76" rx="10"/>
      <path class="bay-notch" d="M96 22 v8 a4 4 0 0 0 4 4 h40 a4 4 0 0 0 4 -4 v-8"/>
      <text x="120" y="70" text-anchor="middle" fill="#9aa8bc" font-size="14">EMPTY SLOT</text>
    </svg>
  </div>
  <h1>Cartridge not found</h1>
  <p>That page is not on this workbench.</p>
  <p><a class="btn" href="/">Back to the shelf</a></p>
</main>`;
  return layout({
    title: "Page not found | Toolstack Lab",
    description: "Page not found on the Toolstack Lab game hub.",
    canonicalPath: "/404",
    ogImage: "/og.jpg",
    body,
    jsonLd: null,
  });
}

/* R4: the public policy page is written for players and publishers here (no repo/tooling wording).
   CONTENT-POLICY.md stays in the repo for contributors and is no longer converted or shipped. */
function policyPage(games) {
  const perGame = games
    .map(
      (g) => `<section id="${esc(g.slug)}" class="policy-game" aria-labelledby="${esc(g.slug)}-h">
  <h3 id="${esc(g.slug)}-h"><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a></h3>
  <dl>
    <div><dt>Made by</dt><dd>${esc(g.author)}</dd></div>
    <div><dt>Licence</dt><dd>${isSelfMade(g) ? "Our own work, all rights reserved" : `<a href="${esc(g.licenseUrl)}" rel="noopener">${esc(g.license)}</a>${g.copyrightNotice ? ` · ${esc(g.copyrightNotice)}` : ""}`}</dd></div>
    ${g.lineage ? `<div><dt>Based on</dt><dd>${esc(g.lineage)}</dd></div>` : ""}
    <div><dt>Source</dt><dd>${g.source === "self-made by Toolstack Lab" ? "Made by Toolstack Lab" : `<a href="${esc(g.source)}" rel="noopener">${esc(g.source)}</a>`}</dd></div>
    <div><dt>Checked</dt><dd><time datetime="${esc(isSelfMade(g) ? g.updated || BUILD_DATE : g.licenseEvidence?.checked || g.updated || BUILD_DATE)}">${esc(isSelfMade(g) ? g.updated || BUILD_DATE : g.licenseEvidence?.checked || g.updated || BUILD_DATE)}</time></dd></div>
  </dl>
</section>`
    )
    .join("\n");
  const body = `
<main id="main" class="wrap">
  <p class="crumb"><a href="/">Games</a> / Content &amp; licence policy</p>
  <section class="page-intro page-intro-tight">
    <h1>Content &amp; licence policy</h1>
    <p>Which games may appear on Toolstack Lab Games, and what we show you about each one.</p>
  </section>
  <div class="page-cols">
  <article class="prose page-main policy-body">
    <h2>What we list</h2>
    <p>${allOwn(games)
      ? "Today every game on this site is made by Toolstack Lab: our own code, art and sound. If we list a game by someone else, such as an open-source classic, it must meet all of these rules:"
      : `The games here are ${MIX_PHRASE}. ${ownShare(games)} are made by Toolstack Lab: our own code, art and sound. A game by someone else must meet all of these rules:`}</p>
    <ul>
      <li>Its licence is a permissive open-source licence (such as MIT, BSD, Apache-2.0 or zlib) or a public-domain dedication that allows commercial use and changes. Copyleft licences (GPL, CC BY-SA) and non-commercial licences are not listed for now.</li>
      <li>Its maker, licence, original source and any changes we made are named on its game page, with the copyright notice the licence asks us to keep.</li>
      <li>It runs on its own web address, separate from this site, inside a sandboxed frame.</li>
    </ul>
    <h2>What we never list</h2>
    <ul>
      <li>Games that infringe a trademark or copy art, characters, levels or other assets we have no rights to. A clearly-licensed open-source classic is fine, but it keeps its author's credit and is never named or presented as an official version.</li>
      <li>Games that need an account or collect personal data just to play.</li>
      <li>Store art or screenshots taken from other sites. Every picture here is a frame from the game itself or art we made.</li>
    </ul>
    <h2>How we vet games</h2>
    <p>A game is only published once its licence and source are on record. Both are shown on every game page and in the list on this page. A game without them cannot be published.</p>
    <h2>Your privacy</h2>
    <p>No ads, no cookies, no scripts that track individuals; we only use cookie-free visit counting. These hub pages set no cookies and load no ad, analytics or other third-party scripts or fonts. We count visits with Cloudflare's cookie-free Web Analytics (no cookies, no personal profiles); its script runs only inside our own games, on their own web addresses, never on these hub pages. Pressing Play on one of our games here loads that game, which counts it as one visit. Game progress is saved in your own browser and never leaves your device.${allOwn(games) ? "" : " Classics run on their own web address, which also sets no cookies; the game keeps only its own progress, such as a best score, in that address's browser storage."}</p>
    <h2>Questions or a problem?</h2>
    <p>If you think a game here breaks this policy, tell us through <a href="https://gettoolstacklab.com">gettoolstacklab.com</a> and we will review it.</p>
  </article>
  <aside class="policy-side" aria-labelledby="games-licences">
    <h2 id="games-licences">Games listed now</h2>
    ${perGame}
  </aside>
  </div>
</main>`;
  return layout({
    title: "Content & Licence Policy | Toolstack Lab",
    description: "Which games may appear on Toolstack Lab Games, how each one's licence and source are shown, and the licence of every game listed today.",
    canonicalPath: "/content-policy/",
    ogImage: "/og.jpg",
    body,
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Content & Licence Policy", url: CANONICAL + "/content-policy/", inLanguage: "en", dateModified: BUILD_DATE, publisher: ORG },
    navActive: "policy",
  });
}

function copyAssets() {
  const assetsSrc = resolve(ROOT, "assets");
  const assetsDst = resolve(DIST, "assets");
  if (existsSync(assetsSrc)) {
    cpSync(assetsSrc, assetsDst, {
      recursive: true,
      filter: (src) => !src.includes(`${join("screenshots", "_raw")}`) && !src.endsWith("_raw"),
    });
  }
  for (const f of ["favicon.png", "favicon-64.png", "og.png", "og.jpg"]) {
    const src = resolve(ROOT, "assets", f);
    if (existsSync(src)) cpSync(src, resolve(DIST, f));
  }
  cpSync(resolve(ROOT, "src/site.css"), resolve(DIST, "site.css"));
  cpSync(resolve(ROOT, "src/site.js"), resolve(DIST, "site.js"));
  if (existsSync(resolve(ROOT, "vercel.json"))) {
    cpSync(resolve(ROOT, "vercel.json"), resolve(DIST, "vercel.json"));
  }
}

function main() {
  const v = spawnSync(process.execPath, [resolve(ROOT, "validate.mjs"), DATA, "--vercel", VERCEL], {
    cwd: ROOT,
    encoding: "utf8",
  });
  process.stdout.write(v.stdout || "");
  process.stderr.write(v.stderr || "");
  if (v.status !== 0) {
    console.error("build aborted: validation failed");
    process.exit(v.status || 1);
  }

  const games = JSON.parse(readFileSync(DATA, "utf8"));
  const stats = JSON.parse(readFileSync(STATS, "utf8"));
  const sorted = [...games].sort((a, b) => score(stats, b.slug) - score(stats, a.slug));

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  write(resolve(DIST, "index.html"), homePage(sorted, stats));
  for (const g of games) {
    write(resolve(DIST, "games", g.slug, "index.html"), detailPage(g, stats, sorted));
  }
  write(resolve(DIST, "popular/index.html"), popularPage(sorted, stats));
  write(resolve(DIST, "about/index.html"), aboutPage(games));
  write(resolve(DIST, "404.html"), notFoundPage());

  write(resolve(DIST, "content-policy/index.html"), policyPage(games));

  const urls = [
    "/",
    "/popular/",
    "/about/",
    "/content-policy/",
    ...games.map((g) => `/games/${g.slug}/`),
  ];
  const lastmod = (u) => {
    const g = games.find((x) => u === `/games/${x.slug}/`);
    return g ? g.updated || BUILD_DATE : BUILD_DATE;
  };
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${CANONICAL}${u}</loc>
    <lastmod>${lastmod(u)}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;
  write(resolve(DIST, "sitemap.xml"), sitemap);
  write(
    resolve(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${CANONICAL}/sitemap.xml\n`
  );

  copyAssets();

  const homeHtml = statSync(resolve(DIST, "index.html")).size;
  const css = statSync(resolve(DIST, "site.css")).size;
  const js = statSync(resolve(DIST, "site.js")).size;
  console.log(
    `OK: built ${games.length} games → ${DIST} (home html+css+js = ${homeHtml + css + js} B excl images)`
  );
}

main();
