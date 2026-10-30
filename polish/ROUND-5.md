# Polish round 5 (final) — micro/motion, first-screen Play, 390 actions row, titles, footer, alignment

Date: 2026-10-30 (EDT). Commits: `a049148` (round 5 implementation), `ea902e6` (status swap without timer), docs commit (this file).
Marker `<!-- polish-r5 -->` live from 15:05 EDT. Current assets `site.css?v=20cc7c5a31` live from 15:13 EDT.

## Saw → changed

| Saw (R4 live baseline, `game-hub-evidence/polish/audit-round-5/baseline-live-r4/`) | Changed |
|---|---|
| Titles 61–64 chars; SEO-PLAN's own suggestions were also >60 | Titles are ≤60, with the game name first and the brand last. The dash became a colon to save characters. The home title uses "No Login" for length; "no account" stays in the H1 and description. Lengths: home, Spud and Pip 60; About 53; Policy 40; Popular 25; 404 30 |
| No Play button in the first 1280×800 screen of home | The hero has a `.hero-actions` row with a "▶ Play Spud Fling" button that goes to `/games/<slug>/#play`, plus "See all 2 games". At 1280 it sits at top 313 / bottom 363 |
| At 390, "Open in new tab" wrapped to its own row (cy 362) | `.detail-actions` is nowrap. At ≤480 the paddings are tighter and "Open in " is visually hidden (the accessible name stays). All three actions are on cy 303. Also fixed the "innew" missing space with `gap:.3em` |
| Popular and 404 footers floated mid-screen (gaps 266/546 px) | body is a column flexbox with `main{flex:1 0 auto}`. Footer gap is 0 on all 7 pages |
| The Spud visits/Updated hint was right-aligned (left 821 vs H1 80) | `.score-hint` moved into `.detail-head`. Left edge is 80 = 80 on both games |
| Policy `<title>` said "Content & Licence Policy" but the H1 said something else | The H1 and breadcrumb now read "Content & licence policy" |
| Dock motion ran 380/520/360 ms; no loading state; status jumped | One token `--dur-dock: 280ms` (dock-in, bay glow, LED, `::after`). `frame.src` is set **first**, before any class or motion work, so the measured click→src time is 2.6–7.5 ms on live. Status goes Ready → Loading… → Docked · <game>: the text swaps synchronously, then a 150 ms opacity fade runs. A 2px loading line shows while `is-loading` and is removed on iframe load. A `TSL·NN` cartridge serial chip pops in with the dock |
| Copy link gave no visible feedback | Labels swap in one grid cell, by opacity only: "Copy link" → "Copied ✓" for 1.5 s. An aria-live region announces it. Share success shows "Shared ✓" |
| No real pressed state | `.btn:active, .bay-play:active` scale to .97 over 80 ms. Cards lift −2px over 140 ms and covers scale to 1.02 over 160 ms |
| — | Reduced motion: every animation and transition is instant (checked: no animation >1 ms). View transitions (150 ms) run only under `no-preference`. Assets are cache-busted with `?v=<sha256-10>` |

## Reviewer items: fixed or not, with checks

Check script: `polish/audit-round-5/r5_check.py`. It failed on R4 live and **passes with 0 failures on live `ea902e6`**: `game-hub-evidence/polish/live-round-5b/after-status-fix-poll/r5_check.json`.

| Item | Status | Check |
|---|---|---|
| Dock 240–320 ms, parallel with src, never delays play | FIXED | R5-dock-motion (all dock animations 240–320 ms, transform/opacity only); R5-instant-play (click→src ≤50 ms; live 2.6–7.5 ms) |
| Status crossfade + 2px loading line | FIXED | R5-dock-motion: status sequence; loading line 2px while loading and gone after load; status fade 100–160 ms |
| "Copied ✓" feedback | FIXED | R5-copy: label visible and live region set (screenshots `copied-*-390/1280.png`) |
| Real pressed states | FIXED | R5-pressed: computed scale under mousedown on Play, Copy and the bay Play button |
| Transform/opacity only; reduced motion instant | FIXED | R5-dock-motion props; R5-reduced-motion |
| Play in the 1280×800 first screen | FIXED | R5-home-play-fold (inFold 1, light and dark) |
| 390: new tab on the same row | FIXED | R5-actions-390 (cy 303/303/303 on both games) |
| Titles ≤60, reconciled with SEO-PLAN | FIXED | R5-titles |
| Popular footer floating | FIXED | R5-footer (gapBelow 0 on all pages) |
| Spud visits/Updated misaligned | FIXED | R5-meta-align-1280 (80/80) |
| Policy title vs H1 | FIXED | R5-titles + H1 read |
| Pip 390 touch overlay over menu (R4 P1) | FIXED game-side (reviewer R5 part A) | — |

## Gates

- Local: `pipeline/reports/20261030-1501-gates-site` PASS, visual P0 0 / P1 0 / P2 37. Six of those are local-only canonical mismatches.
- Live `a049148`: `pipeline/reports/20261030-1505-gates-site` PASS, P0 0 / P1 0 / P2 31.
- Live `ea902e6`: `pipeline/reports/20261030-1520-gates-site` PASS, P0 0 / P1 0 / P2 31. Lighthouse mobile scored 100 on performance, accessibility, best practices and SEO for both pages. Home: LCP 1.03 s, CLS 0. Detail: LCP 1.08 s, CLS 0.
- The remaining P2s were already there before this round: the image parent gap on the shots grid, sky bands baked into letterbox frames, and og-image bands.
- Fixed in-round: an axe contrast P1 ×8 on `.bay-chip` at opacity .55 (local run `20261030-1459`). The fix is full opacity plus a border colour for the docked state.

## Harness note (honest)

The first live run of `a049148` (`live-round-5b/r5_check.json`) failed 5 status-sequence checks. Two causes:

1. The hub used a 150 ms timer for the status swap. Timers were starved while the same-site game iframe loaded. That timer is gone in `ea902e6`.
2. The check used Playwright's rAF-polled `wait_for_function`, which errored early when the renderer was busy. That made Pip's `load` look like it never fired (`after-status-fix/`, `after-status-fix-90s/`).

`pip_probe.py` (`live-round-5b/pip-probe/`) showed what really happens:
- Pip's iframe `load` fires at 2.8 s.
- The hub's main thread is blocked for up to 2.7 s while Pip boots, because `bloom-isle.gettoolstacklab.com` is same-site and shares the renderer process.
- Spud loads at 0.34 s with a max timer gap of 105 ms.

The check now uses plain polling, and the final run (`after-status-fix-poll/`) passes.

## After-scores vs R4 (self-scored; independent review part B pending)

| Axis | R4 | R5 | Why |
|---|---|---|---|
| Whitespace | 4.5 | 4.6 | Footer pinned on short pages; hero now has a CTA row; 390 actions on one row |
| Consistency | 4.5 | 4.6 | One dock duration token; titles, H1 and crumbs match; hint aligned to the H1 |
| Originality | 4.2 | 4.3 | Cartridge serial chip and docking loading line; still a modest step |
| Micro-interactions | 4.2 | 4.5 | Copied ✓, pressed states, card lift, status fade |
| Motion | 4.3 | 4.5 | 280 ms dock in parallel with src, instant under reduced motion. Held below 4.6 because Pip boot janks the hub on live (same-site process) |

## Open items (not hub-fixable or out of scope)

1. Pip (game repo): `ReferenceError: t is not defined` on title-screen touchstart. Fixed only on the `cg-polish` branch, not on master.
2. Pip at 390 (reviewer R5 part A, P2):
   - "Erase progress" is clipped at the bottom of the frame and collides with "More tiny games ↗" (seen in `live-round-5b/after-status-fix-poll/play-pips-bloom-isle-390-no-preference.png`).
   - The touch tutorial says "Press 1 to jump".
   - The tutorial banner overlaps the level title.
3. Pip paused `body.menu` gap (game side).
4. Same-site iframe shares the hub renderer. Pip's boot blocks the hub main thread for about 2.7 s on SwiftShader. Possible fixes: serve the game cross-site (e.g. on `*.pages.dev`) to get an out-of-process iframe, or have the game yield during boot.
5. Older image P2s (shots grid parent gap, letterbox sky bands, og bands).

## Evidence

- `game-hub-evidence/polish/audit-round-5/`:
  - `baseline-live-r4/`
  - `shots-1/` (the GPU-starvation fails)
  - `shots-2/`
  - `shots-final/`
  - `shots-final-2/`
- `game-hub-evidence/polish/live-round-5b/`:
  - `r5_check.json` (a049148, FAIL 5)
  - `after-status-fix/` (FAIL 6, harness)
  - `after-status-fix-90s/` (FAIL 4, harness)
  - `pip-probe/`
  - `after-status-fix-poll/` (**PASS 0**, full screenshots)
