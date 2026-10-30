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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = resolve(ROOT, "dist");
const CANONICAL = "https://games.gettoolstacklab.com";
const SITE_NAME = "Toolstack Lab Games";
const BUILD_DATE = "2026-10-30";
const ORG = { "@type": "Organization", name: "Toolstack Lab", url: "https://gettoolstacklab.com" };
const MAX_TAGS = 3;
const SEARCH_MIN_GAMES = 6;
const TAGLINE =
  "Small games made by Toolstack Lab. Click Play and you are in — no download, no account, no cookies.";
const HOME_DESC =
  "Free 3D browser games by Toolstack Lab: a one-button potato slingshot and a cozy island platformer. Play instantly on desktop or phone. No download, no account.";

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

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function embedUrl(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("internal")) u.searchParams.set("internal", "1");
    return u.toString();
  } catch {
    return url.includes("?") ? url + "&internal=1" : url + "?internal=1";
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
<link rel="stylesheet" href="/site.css">
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
    <div class="copy">© Toolstack Lab · browser games, self-hosted · no trackers</div>
    <nav class="links" aria-label="Footer">
      <a href="/about/">About</a>
      <a href="/popular/">All games</a>
      <a href="/content-policy/">Content policy</a>
      <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>
    </nav>
  </div>
  <!-- polish-r3 -->
</footer>
<div id="toast-host" class="toast-host" aria-live="polite"></div>
<script src="/site.js" defer></script>
</body>
</html>
`;
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
    <div class="cart-plate"><span class="cart-serial" aria-hidden="true">TSL·${String(index + 1).padStart(2, "0")}</span>${featured ? '<span class="cart-badge">Most visited</span>' : ""}</div>
    <h2 class="card-title"><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a></h2>
    <p class="card-pitch">${esc(g.pitch)}</p>
    ${tagsHtml(g)}
    <div class="card-actions">
      <a class="btn" href="/games/${esc(g.slug)}/#play" data-recent-slug="${esc(g.slug)}" data-recent-title="${esc(g.title)}">Play<span class="visually-hidden"> ${esc(g.title)}</span></a>
      <span class="card-score"><span data-count-to="${ht.n}">${ht.n}</span> ${ht.unit === "visits" ? "visits · 14 days" : "plays"}</span>
    </div>
  </div>
</article>`;
}

function homePage(games, stats) {
  const tags = allTags(games);
  const hot = games[0];
  const rest = games.slice(1);

  // R3: one card design for every game (no separate featured slot) — same text sizes, same actions
  const cards = games.map((g, i) => cardHtml(g, stats, { featured: i === 0, index: i })).join("\n");
  const cardCount = games.length;

  const tagBtns = [
    `<button type="button" data-filter-tag="all" aria-pressed="true">All</button>`,
    ...tags.map(
      (t) =>
        `<button type="button" data-filter-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`
    ),
  ].join("\n        ");

  const body = `
<main id="main">
  <section class="hero wrap">
    <div class="hero-kicker">Toolstack Lab Games</div>
    <h1>Free 3D browser games – play instantly, no account</h1>
    <p>${esc(TAGLINE)}</p>
  </section>
  <section class="section wrap" id="games">
    <div class="section-head">
      <h2>All games</h2>
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
  </section>
  <section class="section wrap safe-note" aria-labelledby="safe-h">
    <h2 id="safe-h">Why these games are safe to play</h2>
    <p>Every game here is made by Toolstack Lab. There is no sign-up, no cookies and no ad or tracking scripts; progress stays in your own browser. Each game page lists its licence, and the <a href="/content-policy/">content policy</a> explains what may be listed.</p>
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
    name: SITE_NAME,
    description: HOME_DESC,
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
    title: "Free 3D Browser Games – No Download, No Account | Toolstack Lab",
    description: HOME_DESC,
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
    author: ORG,
    publisher: ORG,
    license: policyUrl,
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
    ["Platforms", "Web browser – desktop and mobile"],
    ["Price", "Free"],
    ["Account needed", "No"],
    ["Save data", "Stays in your browser (localStorage)"],
    ["Made by", "Toolstack Lab"],
    ["Released", g.added],
    ["Updated", updated],
  ]
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${k === "Updated" || k === "Released" ? `<time datetime="${esc(v)}">${esc(v)}</time>` : esc(v)}</dd></div>`)
    .join("");

  const body = `
<main id="main" class="wrap">
  <p class="crumb"><a href="/">Games</a> / ${esc(g.title)}</p>
  <div class="detail-hero detail-hero-text">
    <div class="detail-meta">
      <div class="detail-head">
      <h1>${esc(g.title)}</h1>
      <p class="pitch">${esc(g.subline || g.pitch)}</p>
      ${tagsHtml(g)}
      </div>
      <div class="detail-cta">
      <p class="score-hint">${heat(stats, g.slug).unit === "visits" ? `<span data-count-to="${heat(stats, g.slug).n}">${heat(stats, g.slug).n}</span> visits in the last 14 days` : `<span data-count-to="${Number((stats[g.slug] || {}).plays) || 0}">${Number((stats[g.slug] || {}).plays) || 0}</span> plays in the last 14 days`} · Updated <time datetime="${esc(updated)}">${esc(updated)}</time></p>
      <div class="card-actions pad-top">
        <button type="button" class="btn btn-lg" id="play-embed"
          data-game-url="${esc(embedUrl(g.url))}"
          data-game-slug="${esc(g.slug)}"
          data-game-title="${esc(g.title)}">Play</button>
        <button type="button" class="btn btn-ghost" data-share-url="${esc(CANONICAL + "/games/" + g.slug + "/")}" data-share-title="${esc(g.title)}">Copy link</button>
        <a class="btn-link" href="${esc(g.url)}" target="_blank" rel="noopener">Open in new tab</a>
      </div>
      </div>
    </div>
  </div>

  <section class="play-panel" id="play" aria-label="Play bay">
    <div class="play-bar">
      <span class="bay-led" aria-hidden="true"></span>
      <span class="bay-label">Play bay</span>
      <span class="bay-status" id="bay-status" aria-live="polite">Ready · nothing loads until you press Play</span>
    </div>
    <div class="play-frame-wrap" id="play-frame-wrap">
      <div class="play-placeholder" id="play-placeholder">
        <picture class="bay-cover">
          <source media="(max-width: 480px)" srcset="${esc(coverDir)}/cover-800x1200.jpg">
          <source type="image/webp" srcset="${esc(webpOf(thumb))} 640w, ${esc(webpOf(cover))} 1280w" sizes="(min-width: 1200px) 1200px, 100vw">
          <img src="${esc(cover)}" srcset="${esc(thumb)} 640w, ${esc(cover)} 1280w" sizes="(min-width: 1200px) 1200px, 100vw" alt="${esc(g.coverAlt || g.title)}" width="1280" height="720" decoding="async" fetchpriority="high">
        </picture>
        <button type="button" class="bay-play" id="bay-play" aria-label="Play ${esc(g.title)}"><span class="bay-play-icon" aria-hidden="true"></span><span>Play</span></button>
      </div>
      <div class="play-skeleton" id="play-skeleton" hidden><span>Docking…</span></div>
      <div class="dock-cart" id="dock-cart" aria-hidden="true"><span class="cart-serial">${esc(g.title)}</span></div>
      <iframe id="game-frame" title="${esc(g.title)}" allow="fullscreen; gamepad; autoplay" loading="lazy" referrerpolicy="no-referrer" hidden></iframe>
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
    <h2>Screenshots</h2>
    <div class="shots">
${shots}
    </div>
  </article>

  ${faqBlock(g)}
  </div>
  <aside class="detail-side" aria-label="More on this cartridge">
  ${similarBlock(g, allGames)}

  <section class="license-box prose" id="license" aria-labelledby="license-h">
    <h2 id="license-h">Who made ${esc(g.title)} and its licence</h2>
    <p>Original game by ${esc(g.author)}. Code and art are our own. All rights reserved.</p>
    <dl>
      <div><dt>Licence</dt><dd><a href="/content-policy/#${esc(g.slug)}">Self-made · content policy</a></dd></div>
      <div><dt>Source</dt><dd>${esc(g.source)}</dd></div>
      <div><dt>Checked</dt><dd><time datetime="${esc(updated)}">${esc(updated)}</time></dd></div>
    </dl>
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
    <div class="board-n"><span data-count-to="${ht.n}">${ht.n}</span> ${ht.unit === "visits" ? "visits" : "plays"}</div>
    <div>${Number(st.plays) > 0 ? `${Number(st.visits) || 0} visits · ${Number(st.plays)} plays` : "last 14 days"}</div>
  </div>
</a>`;
    })
    .join("\n");

  const body = `
<main id="main" class="wrap">
  <section class="page-intro">
    <h1>All games</h1>
    <p>Every game on Toolstack Lab Games, most visited first (external visits over the last 14 days). Play counts will appear here once we can measure them.</p>
  </section>
  <section class="section" aria-label="Ranking">
    <div class="board">
${rows}
    </div>
  </section>
</main>`;

  return layout({
    title: "All Games | Toolstack Lab",
    description:
      "All free 3D browser games on Toolstack Lab, most visited first: Spud Fling and Pip's Bloom Isle. Play instantly on desktop or phone, no download or account.",
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

function aboutPage() {
  const body = `
<main id="main" class="wrap">
  <section class="page-intro">
    <h1>About Toolstack Lab Games</h1>
    <p>Toolstack Lab Games is where Toolstack Lab publishes the small 3D browser games it makes. Every game is our own; press Play and it loads right in the page. No accounts, no cookies, no third-party scripts or fonts.</p>
  </section>
  <article class="prose policy-page">
    <div class="about-bay" aria-hidden="true">
      <div class="about-cart"><span class="cart-serial">TSL</span></div>
      <div class="about-slot"></div>
    </div>
    <h2>What you get</h2>
    <ul>
      <li>Self-made games with recorded licence and source in each detail page.</li>
      <li>Iframe docks only after Play — nothing heavy loads until you ask (or open in a new tab).</li>
      <li>Popularity sorted by a documented formula; “recently played” stays on your device only.</li>
    </ul>
    <h2>Lab cartridge workbench</h2>
    <p>Every game gets the same cartridge card with a label plate. On a mouse, hovering a card flips its label to a real screenshot. Play docks the cartridge into the bay — one memorable beat, no video or 3D backgrounds.</p>
    <h2>Audience &amp; boundaries</h2>
    <p>Pip's Bloom Isle is aimed at casual players 13+. We only list what each build already ships. See the <a href="/content-policy/">content policy</a> for licence rules.</p>
    <h2>Contact</h2>
    <p>Parent site: <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>. Source for this hub: public GitHub <code>madlouse/toolstack-games</code>.</p>
  </article>
</main>`;

  return layout({
    title: "About Toolstack Lab Games – Who Makes Them & Licences",
    description:
      "Who makes Toolstack Lab Games, how each game is licensed, and what we never do: no accounts, no cookies, no ad or tracking scripts. Every game is our own.",
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

function policyPage(mdHtml, games) {
  const perGame = games
    .map(
      (g) => `<section id="${esc(g.slug)}" class="policy-game">
  <h3>${esc(g.title)}</h3>
  <p>Original game by ${esc(g.author)}. Code and art are our own. All rights reserved. Licence: ${esc(g.license)}. Source: ${esc(g.source)}. Added ${esc(g.added)}; last checked <time datetime="${esc(g.updated || BUILD_DATE)}">${esc(g.updated || BUILD_DATE)}</time>.</p>
</section>`
    )
    .join("\n");
  const body = `
<main id="main" class="wrap prose policy-page">
  <p class="crumb"><a href="/">Games</a> / Content policy</p>
  ${mdHtml}
  <h2 id="games-licences">Licences of the games listed now</h2>
  ${perGame}
</main>`;
  return layout({
    title: "Content & Licence Policy | Toolstack Lab",
    description: "Which games may appear on Toolstack Lab Games, how each one's licence and source are recorded, and the licence of every game listed today.",
    canonicalPath: "/content-policy/",
    ogImage: "/og.jpg",
    body,
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Content & Licence Policy", url: CANONICAL + "/content-policy/", inLanguage: "en", dateModified: BUILD_DATE, publisher: ORG },
    navActive: "policy",
  });
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeBuf = [];

  function closeLists() {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeLists();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (/^### /.test(line)) {
      closeLists();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (/^## /.test(line)) {
      closeLists();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (/^# /.test(line)) {
      closeLists();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }
    if (/^[-*] /.test(line)) {
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeLists();
      continue;
    }
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return out.join("\n");
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
  if (existsSync(resolve(ROOT, "CONTENT-POLICY.md"))) {
    cpSync(resolve(ROOT, "CONTENT-POLICY.md"), resolve(DIST, "CONTENT-POLICY.md"));
  }
  if (existsSync(resolve(ROOT, "vercel.json"))) {
    cpSync(resolve(ROOT, "vercel.json"), resolve(DIST, "vercel.json"));
  }
}

function main() {
  const v = spawnSync(process.execPath, [resolve(ROOT, "validate.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  process.stdout.write(v.stdout || "");
  process.stderr.write(v.stderr || "");
  if (v.status !== 0) {
    console.error("build aborted: validation failed");
    process.exit(v.status || 1);
  }

  const games = JSON.parse(readFileSync(resolve(ROOT, "data/games.json"), "utf8"));
  const stats = JSON.parse(readFileSync(resolve(ROOT, "data/stats.json"), "utf8"));
  const sorted = [...games].sort((a, b) => score(stats, b.slug) - score(stats, a.slug));

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);

  write(resolve(DIST, "index.html"), homePage(sorted, stats));
  for (const g of games) {
    write(resolve(DIST, "games", g.slug, "index.html"), detailPage(g, stats, games));
  }
  write(resolve(DIST, "popular/index.html"), popularPage(sorted, stats));
  write(resolve(DIST, "about/index.html"), aboutPage());
  write(resolve(DIST, "404.html"), notFoundPage());

  const policyMd = readFileSync(resolve(ROOT, "CONTENT-POLICY.md"), "utf8");
  write(resolve(DIST, "content-policy/index.html"), policyPage(mdToHtml(policyMd), games));

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
