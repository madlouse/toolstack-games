# Round 3 — Toolstack Lab Games hub polish (2026-10-30, America/New_York)

Commits: `d2d8c92` (R3 UI + SEO, marker `<!-- polish-r3 -->`), `b1caa9c` (308 for `/CONTENT-POLICY/`), plus an evidence commit.
Live: https://games.gettoolstacklab.com/ — marker confirmed live (`polish/live-round-3/live_check.json` → `"marker": true`).

## 1. Issues found (listed first)

Open issues after this round (honest):

| # | Sev | Issue | Where seen | Status |
|---|---|---|---|---|
| O1 | P2 | Card title link is 26px tall on touch (Play button next to it is 44px) | live gate `a11y.touch-target` / 320, 768 | open, left for R4 |
| O2 | P2 | Titles 61–64 chars (strings mandated by SEO-PLAN) | gate `seo.title` | accepted |
| O3 | P2 | `image.parent-gap` on screenshot figures: the figcaption is counted as a gap | gate, 24× | false positive |
| O4 | P2 | `letterbox-baked` / `og-image-bands`: this is the sky + title scrim (lum 121–202, mid-tone), not black bars | gate | accepted; `scripts/check-covers.py` proves there is no near-black/white edge band |
| O5 | P2 | `/content-policy/` is a narrow text column at 1920 (30%) with some off-grid spacing (4.416px) | gate `layout.dead-bands-1920`, `space.off-grid` | open |
| O6 | P2 | Pip's own in-game menu title is cut at the top inside a 640px-tall bay at 1280×800 | `polish/live-round-3/desktop-pip-playing.png` | game-repo issue (Pip menu layout), not the hub |
| O7 | info | Plays stats API 403 | — | needs Jack, see §8 |
| O8 | info | Origin canonical on the game hosts | — | needs the game repos + a Jack decision, see §9 |

## 2. Framework P1s (review-framework, Steering 2) — fixed / not

| # | P1 | Fixed? | Evidence |
|---|---|---|---|
| 1 | Spud cover black bars | Fixed. Covers were regenerated from a clean 16:9 in-game frame (`scripts/make-covers.py`). | `polish/audit-round-3/home-1280-light-first.png`; `scripts/check-covers.py` PASS (old thumb FAILs with lum-17 side bands) |
| 2 | Home grid hole | Fixed. One card design for all games, 2-up, with no separate featured card. | `polish/audit-round-3/home-1920-light-first.png`, `home-768-*`; gate `layout.grid-hole` = 0 |
| 3 | Detail right side empty at 1280 | Fixed. The meta row is title/pitch/tags on the left and stats + Play/Copy/Open on the right; the duplicate hero image was removed. | `polish/audit-round-3/spud-1280-light-full.png` |
| 4 | Similar grid hole with 1 card | Fixed. One similar card goes full width (`:has(> :only-child)`), horizontal at 640–1023. | `polish/audit-round-3/spud-768-light-full.png`; gate `layout.grid-hole` |
| 5 | Pip cover = real in-game frame | Fixed. The thumb and cover come from `src/clean-frame-1920.jpg` (gameplay, no menu). | `scripts/check-covers.py` diff 1.7–2.2 (old cbfcc98 thumb: 34.2 FAIL) |
| 6 | Header clips the HUD | Fixed. `#play` has scroll-margin, the header is not sticky on mobile, and the frame top is below the header bottom. | `polish/live-round-3/live_check.json` `clipped:false` on all 5 runs; `mobile-spud-autoplay.png` shows the HUD "0 m / Best 0 m" fully visible |
| 7 | Mobile game ≥55% of viewport height | Fixed: 66% at 390×844, 80% at 1280×800. | `live_check.json` `frame_ratio` |
| 8 | Cover + big Play instead of "BAY EMPTY" | Fixed. The bay shows the cover picture (portrait 800×1200 at ≤480px) with a 64px Play pill. | `polish/audit-round-3/spud-390-light-first.png` |
| 9 | Brand "Toolstack Lab Games", no CN/EN mix | Fixed. 0 "游戏" in dist; eyebrow + og title read "Toolstack Lab Games". | `grep -r 游戏 dist` = 0; `assets/og.jpg` |
| 10 | Hide hover, "/" and Enter copy on touch | Fixed. The hover hint copy was removed, `.hint-fine` is hidden on `(hover:none),(pointer:coarse)`, and the preview layer is hidden on touch. | `pages.json` `hint_visible:false` at 390/768 |

## 3. Gate P1 classes (Steering 3) — 0 locally and live, with the check that reproduces each

| P1 class | Regression check | Local `20261030-1319` | Live `20261030-1336` |
|---|---|---|---|
| Sticky header clips the game HUD | pipeline `tools/visual_check.py` `game.iframe-occluded` / `game.iframe-visible` (390 play pass) + `polish/live-round-3/live_check.py` (`clipped`) | 0 | 0 |
| Spud thumbnail black bars | `image.letterbox-baked` / `image.letterbox-dom` + `assets-live` / `assets-hub-src` (asset_check) + **new `scripts/check-covers.py`** | 0 P1 | 0 P1 |
| Single-card grid hole | `layout.grid-hole` (fired on similar @768 in run 1312, now 0) | 0 | 0 |
| Images not loaded show black blocks | `loading.placeholder` (fired on home @390 preview-layer in 1312; fixed by hiding it on touch + LQIP behind screenshots) | 0 | 0 |
| Fonts ≤2 families | `type.font-families` (system-ui + TSL Display) | 0 | 0 |
| Touch targets | `a11y.touch-target` (P1 for <24px; 24–44px is P2, see O1) | 0 P1 | 0 P1 |
| Pip cover = real in-game frame | **new `scripts/check-covers.py`** (matches thumb/cover against the clean gameplay frame below the title scrim; old Pip thumb FAILs) | PASS | PASS (same files deployed) |

The local run had 1 P0 + 2 P1, all production-only. The sitemap uses absolute prod URLs, so `seo.sitemap-url` hit the not-yet-deployed `/content-policy/`, and `seo.og-image` hit the not-yet-deployed per-game `og.jpg`. Both cleared on the live run.
Earlier local run `20261030-1312` (P0 1, P1 13): the 13 P1s were `text.max-lines` on the old detail title, the grid hole @768, the loading placeholder, plus the same prod-only ones. All were fixed before deploy.

Gate reports:
- Pre-deploy (local http://localhost:4173): `/workspace/exp28-games/pipeline/reports/20261030-1319-gates-site/SUMMARY.md`
- Post-deploy (live): `/workspace/exp28-games/pipeline/reports/20261030-1336-gates-site/SUMMARY.md`. **Gate: PASS**; P0 0, P1 0, P2 46.

## 4. P2s and SEO done

- P2s:
  - ≤3 tags on cards
  - no green glow blob on mobile
  - no shelf shadow
  - teeth/grip/spine off the image
  - no formula / "HOT" / ★ copy
  - search hidden when there are fewer than 6 games
  - LQIP placeholders for screenshots
  - footer, skip-link and section links ≥44px
  - genre cards turned into prose
  - FAQ as a details list
- SEO:
  - Per-game `seoTitle` / `seoDescription` templates, with og:title/description equal to them.
  - English h1. Home H1 is "Free 3D browser games – play instantly, no account".
  - A 1200×630 `og.jpg` per game plus `og:image:alt`; the new home og has no tofu glyphs or menu.
  - JSON-LD: VideoGame+WebApplication per game; WebSite+Organization on home; WebPage on the policy page.
  - Sitemap `lastmod`.
  - `/content-policy/` with 308s from `/CONTENT-POLICY.html`, `/CONTENT-POLICY` and `/CONTENT-POLICY/`. Verified live: `.html` → 308 → `/CONTENT-POLICY/` → 308 → `/content-policy/` → 200.
- Constraints kept:
  - No inline styles (`grep style= dist` = 0)
  - CSP unchanged except that the `/og.(png|jpg)` header source was widened
  - No third-party scripts, fonts or cookies
  - Motion is transform/opacity only
  - Play sets the iframe src 65–106 ms after click (live)

## 5. Shots (DPR 1, light + dark, first-screen + full page)

Local: `polish/audit-round-3/{page}-{w}-{theme}-{first|full}.png` (7 pages × 4 widths × 2 themes; metrics in `pages.json`).
Live: `polish/live-round-3/shots/` (same matrix, 56 page loads; only console errors are the intended 404 status on the 404 page), plus `mobile-spud-autoplay.png`, `{mobile,desktop}-{spud,pip}-playing.png`.

| Page | 390 | 768 | 1280 | 1920 |
|---|---|---|---|---|
| home | Saw: the hover-hint sentence on touch, and the featured card differing from the others. Changed: hint removed, one card design. | Saw: 2 different card designs and a hole. Changed: unified 2-up. | Saw: featured + shelf asymmetry. Changed: 2 equal cards + "Most visited" badge. | Saw: wide empty sides. Changed: kept the 1120 cap, centred (accepted L8). |
| spud detail | Saw: "BAY EMPTY" text and an awkward sky crop. Changed: portrait cover + 64px Play pill. | Saw: the similar card in 2 tracks (hole). Changed: one card full width. | Saw: empty right side + duplicate cover. Changed: meta/CTA row, one cover. | Saw: the same. Changed: the same row; bay capped. |
| pip detail | Saw: the cover was a menu screenshot. Changed: real gameplay frame. | Same similar-card fix. | Same as Spud. | Same as Spud. |
| popular | Saw: OK, "0 plays" absent. Changed: nothing new. | OK | OK | OK |
| about | Saw: CN/EN mix earlier. Changed: English copy, prose genres. | OK | OK | OK |
| policy | Saw: the old URL, no JSON-LD. Changed: `/content-policy/`, WebPage LD, anchors. | OK | OK | Narrow column (O5, open) |
| 404 | Saw: OK. Local console shows 1 error, which is the expected 404 status of the test URL. | OK | OK | OK |

Dark theme: same layout. I checked contrast on the bay Play pill (#05140c on #3dd68c, 10.1:1) and on badge text. Dark home 390: `polish/audit-round-3/home-390-dark-full.png`.

## 6. Scores

BEFORE (from the brief): typo 4.0, whitespace 4.0, hierarchy 4.3, color 4.2, motion 4.2, micro 4.2, responsive 3.8, originality 3.9.

Framework §5.3 (honest, self-scored; an independent review is pending):

| Dimension | 1–5 | Evidence | Reason |
|---|---|---|---|
| First-screen clarity (5 s) | 4.5 | `home-1280-light-first.png`, `spud-390-light-first.png` | The H1 says what and how; both games and Play are above the fold |
| Click-to-play path | 4.5 | `live_check.json`, `mobile-spud-autoplay.png` | One tap; src set in under 110 ms; HUD visible; 66% of viewport height on mobile |
| Cognitive load | 4.0 | `home-768-light-full.png` | 2 cards, ≤3 tags, no search; the detail page is still long (facts + tips + FAQ) |
| Whitespace and line breaks (L1–L13) | 3.8 | `home-1920-light-first.png`, policy-1920 | 1920 side space and the policy column remain |
| Visual consistency | 4.3 | home/detail shots, both themes | One card design, 2 fonts, one green accent |
| Trust signals | 4.2 | home "safe to play" section, licence box | Self-made statement + policy; no external proof yet |
| Responsive (4 widths × 2 themes) | 4.2 | `polish/audit-round-3/*-{390..1920}-{light,dark}-*.png` | No overflow and no holes; card-title target 26px (O1) |
| Accessibility and performance floor | Pass | `polish/live-round-3/lighthouse-mobile-{home,detail}.json` | LH mobile (simulated 4G) perf/a11y/BP/SEO 100/100/100/100. LCP: home 1.17 s, detail 1.08 s. CLS 0 / 0 |

Legacy rubric AFTER: typo 4.4, whitespace 4.2, hierarchy 4.5, color 4.4, motion 4.3, micro 4.3, responsive 4.3, originality 4.0.

## 7. Pipeline
I used `/workspace/exp28-games/pipeline/` (README, QUALITY-GATES, ROADMAP, PIPELINE §2 site W3/W4) and ran `./run-gates.sh site <url>` before and after deploy. Repo-side checks added: `scripts/check-covers.py` (run with `python3 scripts/check-covers.py`; PIL only) and `scripts/make-covers.py` (asset generator).
The Spud/live self-test is `polish/live-round-3/live_check.py`. It is run as `/workspace/.venv-pw/bin/python polish/live-round-3/live_check.py` and writes only to `polish/live-round-3/`. Historical `live-round-1/2` were not touched.

## 8. Stats 403
The plays/visits API returns 403 from Cloudflare Analytics Engine SQL because the API token lacks **Account › Account Analytics › Read**. Fixing it needs Jack to edit that token's permissions in the Cloudflare dashboard. It costs nothing and needs no code change (ROADMAP J7). Until then, the hub shows the build-time visit counts and never shows "0 plays".

## 9. Origin canonical (not changed)
The game hosts (tsl-game1.pages.dev, bloom-isle.gettoolstacklab.com) still self-canonicalise. Pointing their canonical at the hub detail pages needs changes in the game repos and a decision from Jack; I did not change them.
