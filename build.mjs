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
const TAGLINE = "Tiny browser 3D games from Toolstack Lab. No accounts, no cookies, play in one click.";

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
  // Prefer cookieless internal mode when games support ?internal=1 (skips CF beacon).
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

function layout({ title, description, canonicalPath, ogImage, body, jsonLd, extraHead = "" }) {
  const canon = `${CANONICAL}${canonicalPath}`;
  const og = ogImage.startsWith("http") ? ogImage : `${CANONICAL}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canon)}">
<meta name="theme-color" content="#0e1218">
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
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
</head>
<body>
<header class="site-header">
  <div class="wrap inner">
    <a class="brand" href="/">
      <span class="brand-name">Toolstack Lab</span>
      <span class="brand-sub">AI 3D 游戏合集</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/#games">Games</a>
      <a href="/CONTENT-POLICY.html">Policy</a>
    </nav>
  </div>
</header>
${body}
<footer class="site-footer">
  <div class="wrap inner">
    <div>© Toolstack Lab · browser games, self-hosted · no trackers</div>
    <div>
      <a href="/CONTENT-POLICY.html">Content policy</a>
      ·
      <a href="https://gettoolstacklab.com">gettoolstacklab.com</a>
    </div>
  </div>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}

function homePage(games, stats) {
  const cards = games
    .map((g) => {
      const sc = score(stats, g.slug);
      const thumb = "/" + g.thumbnail.replace(/^\/+/, "");
      const thumbWebp = thumb.replace(/\.jpe?g$/i, ".webp");
      return `<article class="card">
  <a class="card-thumb" href="/games/${esc(g.slug)}/" aria-label="${esc(g.title)}">
    <picture>
      <source type="image/webp" srcset="${esc(thumbWebp)}">
      <img src="${esc(thumb)}" alt="${esc(g.title)} thumbnail" width="640" height="360" loading="lazy" decoding="async">
    </picture>
  </a>
  <div class="card-body">
    <h2 class="card-title"><a href="/games/${esc(g.slug)}/">${esc(g.title)}</a></h2>
    <p class="card-pitch">${esc(g.pitch)}</p>
    <div class="tags">${g.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <div class="card-actions">
      <a class="btn" href="/games/${esc(g.slug)}/#play" data-recent-slug="${esc(g.slug)}" data-recent-title="${esc(g.title)}">Play</a>
      <span class="score-hint" title="score = plays×3 + visits">★ ${sc}</span>
    </div>
  </div>
</article>`;
    })
    .join("\n");

  const body = `
<main>
  <section class="hero wrap">
    <h1>${esc(SITE_NAME)}</h1>
    <p>${esc(TAGLINE)}</p>
  </section>
  <section class="section wrap" id="games">
    <div class="section-head">
      <h2>Games</h2>
      <span class="score-hint">Sorted by popularity (plays×3 + visits)</span>
    </div>
    <div class="grid">
${cards}
    </div>
    <aside class="recent" id="recent-played" hidden>
      <h2>Recently played on this device</h2>
      <ul></ul>
    </aside>
  </section>
</main>`;

  return layout({
    title: SITE_NAME,
    description: TAGLINE,
    canonicalPath: "/",
    ogImage: "/og.png",
    body,
    jsonLd: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: SITE_NAME,
      description: TAGLINE,
      url: CANONICAL + "/",
      isPartOf: { "@type": "WebSite", name: "Toolstack Lab", url: "https://gettoolstacklab.com" },
      hasPart: games.map((g) => ({
        "@type": "VideoGame",
        name: g.title,
        url: `${CANONICAL}/games/${g.slug}/`,
      })),
    }),
  });
}

function detailPage(g, stats) {
  const sc = score(stats, g.slug);
  const thumb = "/" + g.thumbnail.replace(/^\/+/, "");
  const shots = g.screenshots
    .map((s, i) => {
      const src = "/" + s.replace(/^\/+/, "");
      const webp = src.replace(/\.jpe?g$/i, ".webp");
      return `<figure>
  <picture>
    <source type="image/webp" srcset="${esc(webp)}">
    <img src="${esc(src)}" alt="${esc(g.title)} screenshot ${i + 1}" width="1280" height="720" loading="lazy" decoding="async">
  </picture>
</figure>`;
    })
    .join("\n");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: g.title,
    description: g.description,
    url: `${CANONICAL}/games/${g.slug}/`,
    image: `${CANONICAL}${thumb}`,
    author: { "@type": "Organization", name: g.author },
    publisher: { "@type": "Organization", name: "Toolstack Lab" },
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    genre: g.tags,
    datePublished: g.added,
  });

  const body = `
<main class="wrap">
  <p class="crumb"><a href="/">Games</a> / ${esc(g.title)}</p>
  <div class="detail-hero">
    <div class="detail-media">
      <picture>
        <source type="image/webp" srcset="${esc(thumb.replace(/\.jpe?g$/i, ".webp"))}">
        <img src="${esc(thumb)}" alt="${esc(g.title)}" width="640" height="360" decoding="async">
      </picture>
    </div>
    <div class="detail-meta">
      <h1>${esc(g.title)}</h1>
      <p class="pitch">${esc(g.pitch)}</p>
      <div class="tags">${g.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <p class="score-hint" class="score-hint pad-top">Popularity score ${sc} (plays×3 + visits)</p>
      <div class="card-actions" class="card-actions pad-top">
        <a class="btn btn-lg" href="#play">Play</a>
        <a class="btn btn-secondary" href="${esc(g.url)}" target="_blank" rel="noopener">Open in new tab</a>
      </div>
    </div>
  </div>

  <section class="play-panel" id="play">
    <div class="play-bar">
      <button type="button" class="btn" id="play-embed"
        data-game-url="${esc(embedUrl(g.url))}"
        data-game-slug="${esc(g.slug)}"
        data-game-title="${esc(g.title)}">Play in page</button>
      <a class="btn btn-secondary" href="${esc(g.url)}" target="_blank" rel="noopener">Open in new tab</a>
      <span class="score-hint">Game loads only after you click — keeps this page light.</span>
    </div>
    <div class="play-frame-wrap" id="play-frame-wrap">
      <div class="play-placeholder" id="play-placeholder">
        <div>Ready when you are.</div>
        <button type="button" class="btn" id="play-embed-alt">Load ${esc(g.title)}</button>
      </div>
      <iframe id="game-frame" title="${esc(g.title)}" allow="fullscreen; gamepad; autoplay" allowfullscreen loading="lazy" referrerpolicy="no-referrer" hidden></iframe>
    </div>
  </section>

  <article class="prose">
    <h2>About</h2>
    <p>${esc(g.description)}</p>
    <h2>How to play / controls</h2>
    <p>${esc(g.controls)}</p>
    <h2>Screenshots</h2>
    <div class="shots">
${shots}
    </div>
    <div class="license-box">
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
  </article>
</main>`;

  return layout({
    title: `${g.title} · ${SITE_NAME}`,
    description: g.pitch,
    canonicalPath: `/games/${g.slug}/`,
    ogImage: thumb,
    body,
    jsonLd,
  });
}

function notFoundPage() {
  const body = `
<main class="wrap error-page">
  <h1>404</h1>
  <p>That page is not in this collection.</p>
  <p><a class="btn" href="/">Back to games</a></p>
</main>`;
  return layout({
    title: `Not found · ${SITE_NAME}`,
    description: "Page not found",
    canonicalPath: "/404",
    ogImage: "/og.png",
    body,
    jsonLd: null,
  });
}

function policyPage(mdHtml) {
  const body = `
<main class="wrap prose policy-page">
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
  });
}

/** Tiny markdown → HTML for the policy page (headings, lists, paragraphs, code). */
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
  // flatten favicon + og to dist root
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
  // validate first
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
    write(resolve(DIST, "games", g.slug, "index.html"), detailPage(g, stats));
  }
  write(resolve(DIST, "404.html"), notFoundPage());

  const policyMd = readFileSync(resolve(ROOT, "CONTENT-POLICY.md"), "utf8");
  write(resolve(DIST, "CONTENT-POLICY.html"), policyPage(mdToHtml(policyMd)));

  const urls = ["/", "/CONTENT-POLICY.html", ...games.map((g) => `/games/${g.slug}/`)];
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

  // report home weight excl thumbnails
  const homeHtml = statSync(resolve(DIST, "index.html")).size;
  const css = statSync(resolve(DIST, "site.css")).size;
  const js = statSync(resolve(DIST, "site.js")).size;
  console.log(
    `OK: built ${games.length} games → ${DIST} (home html+css+js = ${homeHtml + css + js} B excl images)`
  );
}

main();
