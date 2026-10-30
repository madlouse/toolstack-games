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
const SITE_NAME = "Toolstack Lab · AI 3D 游戏合集";
const TAGLINE =
  "Tiny browser 3D games from Toolstack Lab. No accounts, no cookies, play in one click.";

function score(stats, slug) {
  const s = stats[slug] || { visits: 0, plays: 0 };
  return (Number(s.plays) || 0) * 3 + (Number(s.visits) || 0);
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
}) {
  const canon = `${CANONICAL}${canonicalPath}`;
  const og = ogImage.startsWith("http")
    ? ogImage
    : `${CANONICAL}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;

  const nav = [
    { href: "/#games", id: "games", label: "Games" },
    { href: "/popular/", id: "popular", label: "Popular" },
    { href: "/about/", id: "about", label: "About" },
    { href: "/CONTENT-POLICY.html", id: "policy", label: "Policy" },
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(og)}">
<link rel="icon" href="/favicon.png" type="image/png">
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
      <span class="brand-sub">AI 3D 游戏合集</span>
    </a>
    <nav class="nav" aria-label="Primary">
      ${nav}
    </nav>
  </div>
</header>
${body}
<footer class="site-footer">
  <div class="wrap inner">
    <div>© Toolstack Lab · browser games, self-hosted · no trackers</div>
    <div>
      <a href="/about/">About</a>
      ·
      <a href="/popular/">Popular</a>
      ·
      <a href="/CONTENT-POLICY.html">Content policy</a>
      ·
      <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>
    </div>
  </div>
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

function cardHtml(g, stats, { featured = false } = {}) {
  const sc = score(stats, g.slug);
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
      <img src="${esc(thumb)}" alt="${esc(g.title)} thumbnail" width="640" height="360" loading="${featured ? "eager" : "lazy"}" decoding="async"${featured ? ' fetchpriority="high"' : ""}>
    </picture>
    <picture class="preview-layer" aria-hidden="true">
      <source type="image/webp" srcset="${esc(previewWebp)}">
      <img src="${esc(preview)}" alt="" width="640" height="360" loading="lazy" decoding="async">
    </picture>
  </a>
  <div class="card-body">
    <h2 class="card-title"><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a></h2>
    <p class="card-pitch">${esc(g.pitch)}</p>
    <div class="tags">${(g.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div class="card-actions">
      <a class="btn" href="/games/${esc(g.slug)}/#play" data-recent-slug="${esc(g.slug)}" data-recent-title="${esc(g.title)}">Play</a>
      <span class="card-score" title="score = plays×3 + visits">★ <span data-count-to="${sc}">${sc}</span></span>
    </div>
  </div>
</article>`;
}

function homePage(games, stats) {
  const tags = allTags(games);
  const hot = games[0];
  const rest = games.slice(1);

  const featured = hot
    ? `<section class="featured" aria-label="Hottest game">
  <div class="detail-media">
    <picture>
      <source type="image/webp" srcset="${esc(webpOf(assetPath(hot.thumbnail)))}">
      <img src="${esc(assetPath(hot.thumbnail))}" alt="${esc(hot.title)}" width="640" height="360" decoding="async" fetchpriority="high">
    </picture>
  </div>
  <div>
    <div class="featured-badge">Hot cartridge · score <span data-count-to="${score(stats, hot.slug)}">${score(stats, hot.slug)}</span></div>
    <h2><a href="/games/${esc(hot.slug)}/">${esc(hot.title)}</a></h2>
    <p class="pitch">${esc(hot.pitch)}</p>
    <div class="tags">${(hot.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div class="card-actions pad-top">
      <a class="btn btn-lg" href="/games/${esc(hot.slug)}/#play" data-recent-slug="${esc(hot.slug)}" data-recent-title="${esc(hot.title)}">Play</a>
      <a class="btn btn-secondary" href="/games/${esc(hot.slug)}/">Details</a>
    </div>
  </div>
</section>`
    : "";

  const cards = (rest.length ? rest : games)
    .map((g) => cardHtml(g, stats))
    .join("\n");

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
    <div class="hero-kicker">Lab cartridge workbench</div>
    <h1>${esc(SITE_NAME)}</h1>
    <p>${esc(TAGLINE)} Press <span class="kbd">/</span> to filter. Hover a cartridge to flip its label.</p>
  </section>
  <section class="section wrap" id="games">
    <div class="section-head">
      <h2>Games on the bench</h2>
      <span class="score-hint">Sorted by popularity (plays×3 + visits) · <a href="/popular/">full board</a></span>
    </div>
    ${featured}
    <div class="toolbar">
      <div class="search-wrap">
        <label for="game-search">Search games</label>
        <span class="search-icon" aria-hidden="true">/</span>
        <input id="game-search" type="search" placeholder="Search title, tag, pitch…" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="tag-filters" role="group" aria-label="Filter by tag">
        ${tagBtns}
      </div>
    </div>
    <p class="filter-hint">Tip: <span class="kbd">/</span> focuses search · <span class="kbd">Enter</span> plays the focused cartridge</p>
    <div class="grid" id="games-grid">
${cards}
    </div>
    <p class="empty-filter" id="filter-empty" hidden>No cartridges match that filter.</p>
    <aside class="recent" id="recent-played" hidden>
      <h2>Recently played on this device</h2>
      <ul></ul>
    </aside>
  </section>
</main>`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: SITE_NAME,
    description: TAGLINE,
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
    description: TAGLINE,
    url: CANONICAL + "/",
    isPartOf: {
      "@type": "WebSite",
      name: "Toolstack Lab",
      url: "https://gettoolstacklab.com",
    },
    mainEntity: { "@id": CANONICAL + "/#itemlist" },
  };
  itemList["@id"] = CANONICAL + "/#itemlist";

  return layout({
    title: SITE_NAME,
    description: TAGLINE,
    canonicalPath: "/",
    ogImage: "/og.png",
    body,
    jsonLd: [collection, itemList],
    navActive: "games",
  });
}

function similarBlock(g, allGames) {
  const others = allGames.filter((x) => x.slug !== g.slug);
  const genres = (g.similarGenres || [])
    .map(
      (sg) => `<div class="similar-item">
  <h3>${esc(sg.genre)}</h3>
  <p>${esc(sg.blurb)}</p>
</div>`
    )
    .join("\n");

  const also =
    others.length > 0
      ? `<p class="also">Also on this hub: ${others
          .map((o) => `<a href="/games/${esc(o.slug)}/">${esc(o.title)}</a>`)
          .join(" · ")}</p>`
      : "";

  return `<section class="prose" aria-labelledby="similar-h">
  <h2 id="similar-h">Similar games</h2>
  <p>Honest genre neighbours — not claims that other studios’ titles are ours. Links below go only to games on this hub.</p>
  <div class="similar-list">
${genres}
  </div>
  ${also}
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
      return `<figure>
  <picture>
    <source type="image/webp" srcset="${esc(webp)}">
    <img src="${esc(src)}" alt="${esc(g.title)} screenshot ${i + 1}" width="1280" height="720" loading="lazy" decoding="async">
  </picture>
</figure>`;
    })
    .join("\n");

  const tips = (g.tips || [])
    .map((t) => `<li>${esc(t)}</li>`)
    .join("\n");

  const how = g.howToPlay || g.description;
  const kb = g.controlsKeyboard || g.controls;
  const touch = g.controlsTouch || g.controls;

  const videoGameLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: g.title,
    description: g.description,
    url: `${CANONICAL}/games/${g.slug}/`,
    image: `${CANONICAL}${thumb}`,
    author: { "@type": "Organization", name: g.author },
    publisher: { "@type": "Organization", name: "Toolstack Lab" },
    gamePlatform: g.gamePlatform || "Web browser",
    playMode: g.playMode || "SinglePlayer",
    applicationCategory: g.applicationCategory || "Game",
    operatingSystem: g.operatingSystem || "Any",
    inLanguage: g.inLanguage || "en",
    genre: g.tags,
    datePublished: g.added,
    license: g.licenseUrl && g.licenseUrl.startsWith("http") ? g.licenseUrl : undefined,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  // Keep license as text when no URL
  if (!videoGameLd.license) {
    videoGameLd.license = g.license;
  }

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

  const pageTitle = `${g.title} — play free in browser · ${SITE_NAME}`;
  const pageDesc = `${g.pitch} Controls, tips, FAQ, and licence. Free browser play, no account.`;

  const body = `
<main id="main" class="wrap">
  <p class="crumb"><a href="/">Games</a> / ${esc(g.title)}</p>
  <div class="detail-hero">
    <div class="detail-media">
      <picture>
        <source type="image/webp" srcset="${esc(webpOf(thumb))}">
        <img src="${esc(thumb)}" alt="${esc(g.title)}" width="640" height="360" decoding="async" fetchpriority="high">
      </picture>
    </div>
    <div class="detail-meta">
      <h1>${esc(g.title)}</h1>
      <p class="pitch">${esc(g.pitch)}</p>
      <div class="tags">${(g.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <p class="score-hint pad-top">Popularity score <span data-count-to="${sc}">${sc}</span> (plays×3 + visits)</p>
      <div class="card-actions pad-top">
        <a class="btn btn-lg" href="#play">Play</a>
        <button type="button" class="btn btn-secondary" data-share-url="${esc(CANONICAL + "/games/" + g.slug + "/")}" data-share-title="${esc(g.title)}">Copy link</button>
      </div>
    </div>
  </div>

  <section class="play-panel" id="play" aria-label="Play bay">
    <div class="play-bar">
      <span class="bay-label">Play bay · dock cartridge</span>
      <button type="button" class="btn" id="play-embed"
        data-game-url="${esc(embedUrl(g.url))}"
        data-game-slug="${esc(g.slug)}"
        data-game-title="${esc(g.title)}">Play in page</button>
      <a class="btn btn-secondary" href="${esc(g.url)}" target="_blank" rel="noopener">Open in new tab</a>
    </div>
    <div class="play-frame-wrap" id="play-frame-wrap">
      <div class="play-placeholder" id="play-placeholder">
        <div>Cartridge ready — click Play to dock it. Game loads only after you click.</div>
        <button type="button" class="btn" id="play-embed-alt">Load ${esc(g.title)}</button>
      </div>
      <div class="play-skeleton" id="play-skeleton" hidden>Docking…</div>
      <iframe id="game-frame" title="${esc(g.title)}" allow="fullscreen; gamepad; autoplay" loading="lazy" referrerpolicy="no-referrer" hidden></iframe>
    </div>
  </section>

  <article class="prose">
    <h2>What it is &amp; how to play</h2>
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
    <h2>Tips</h2>
    <ul>
${tips}
    </ul>
    <h2>Screenshots</h2>
    <div class="shots">
${shots}
    </div>
  </article>

  ${similarBlock(g, allGames)}
  ${faqBlock(g)}

  <div class="license-box" id="license">
    <h2 class="visually-hidden">License &amp; source</h2>
    <dl>
      <dt>License</dt>
      <dd>${esc(g.license)}${g.licenseUrl ? ` · ${esc(g.licenseUrl)}` : ""}</dd>
      <dt>Source</dt>
      <dd>${esc(g.source)}</dd>
      <dt>Author</dt>
      <dd>${esc(g.author)}</dd>
      <dt>Status</dt>
      <dd>${esc(g.status)} · added ${esc(g.added)}</dd>
    </dl>
  </div>
</main>`;

  return layout({
    title: pageTitle,
    description: pageDesc,
    canonicalPath: `/games/${g.slug}/`,
    ogImage: thumb,
    body,
    jsonLd: [videoGameLd, breadcrumbLd, faqLd].filter(Boolean),
    navActive: "games",
  });
}

function popularPage(games, stats) {
  const rows = games
    .map((g, i) => {
      const sc = score(stats, g.slug);
      const st = stats[g.slug] || { visits: 0, plays: 0 };
      return `<a class="board-row" href="/games/${esc(g.slug)}/">
  <div class="board-rank">#${i + 1}</div>
  <div class="board-meta">
    <h2>${esc(g.title)}</h2>
    <p>${esc(g.pitch)}</p>
  </div>
  <div class="board-score">
    <div>★ <span data-count-to="${sc}">${sc}</span></div>
    <div>${Number(st.visits) || 0} visits · ${Number(st.plays) || 0} plays</div>
  </div>
</a>`;
    })
    .join("\n");

  const body = `
<main id="main" class="wrap">
  <section class="page-intro">
    <h1>Popularity board</h1>
    <p>Score = plays × 3 + visits. Seed counts are documented visits only; plays may be 0 when playtime export was unavailable. Client “recently played” is never a popularity signal.</p>
  </section>
  <section class="section" aria-label="Ranking">
    <div class="board">
${rows}
    </div>
  </section>
</main>`;

  return layout({
    title: `Popularity board · ${SITE_NAME}`,
    description:
      "Popularity ranking for Toolstack Lab browser games. Score = plays×3 + visits.",
    canonicalPath: "/popular/",
    ogImage: "/og.png",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Popularity board",
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
    <h1>About this hub</h1>
    <p>Toolstack Lab’s public shelf for tiny browser 3D games we made ourselves. No accounts, no cookies, no third-party scripts or fonts. Click Play and the game docks into the play bay.</p>
  </section>
  <article class="prose policy-page">
    <h2>What you get</h2>
    <ul>
      <li>Self-made games with recorded licence and source in each detail page.</li>
      <li>On-click iframe play (or open in a new tab) — nothing heavy loads until you ask.</li>
      <li>Popularity sorted by a documented formula; “recently played” stays on your device only.</li>
    </ul>
    <h2>Lab cartridge metaphor</h2>
    <p>Home cards are labeled cartridges on a workbench. Hover flips the label through a real screenshot. Play docks the cartridge into a glowing bay — a cheap, memorable interaction without video or 3D backgrounds.</p>
    <h2>Audience &amp; boundaries</h2>
    <p>Pip's Bloom Isle is aimed at casual players 13+. We only list what each build already ships. See the <a href="/CONTENT-POLICY.html">content policy</a> for licence rules.</p>
    <h2>Contact</h2>
    <p>Parent site: <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>. Source for this hub: public GitHub <code>madlouse/toolstack-games</code>.</p>
  </article>
</main>`;

  return layout({
    title: `About · ${SITE_NAME}`,
    description:
      "About the Toolstack Lab AI 3D game hub: self-made browser games, no trackers, cartridge play bay.",
    canonicalPath: "/about/",
    ogImage: "/og.png",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: `About · ${SITE_NAME}`,
      url: CANONICAL + "/about/",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: CANONICAL + "/" },
    },
    navActive: "about",
  });
}

function notFoundPage() {
  const body = `
<main id="main" class="wrap error-page">
  <h1>404</h1>
  <p>That page is not in this collection.</p>
  <p><a class="btn" href="/">Back to games</a></p>
</main>`;
  return layout({
    title: `Not found · ${SITE_NAME}`,
    description: "Page not found on the Toolstack Lab game hub.",
    canonicalPath: "/404",
    ogImage: "/og.png",
    body,
    jsonLd: null,
  });
}

function policyPage(mdHtml) {
  const body = `
<main id="main" class="wrap prose policy-page">
  <p class="crumb"><a href="/">Games</a> / Content policy</p>
  ${mdHtml}
</main>`;
  return layout({
    title: `Content policy · ${SITE_NAME}`,
    description: "Which games may appear on the Toolstack Lab game hub.",
    canonicalPath: "/CONTENT-POLICY.html",
    ogImage: "/og.png",
    body,
    jsonLd: null,
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
  write(resolve(DIST, "CONTENT-POLICY.html"), policyPage(mdToHtml(policyMd)));

  const urls = [
    "/",
    "/popular/",
    "/about/",
    "/CONTENT-POLICY.html",
    ...games.map((g) => `/games/${g.slug}/`),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${CANONICAL}${u}</loc>
    <changefreq>weekly</changefreq>
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
