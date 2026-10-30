# Round 4 — Playbook R3 P1s + cheap P2s

Date: 2026-10-30 (EDT). Hub commit **85747f0** (pushed to `main`, Vercel auto-deploy). Live marker `<!-- polish-r4 -->` confirmed at 14:17 EDT.

## Changes (saw X → changed Y)

| # | Saw | Changed |
|---|-----|---------|
| P1-1 | `/content-policy/` was naive md→HTML of CONTENT-POLICY.md: literal `- ` list text, dev words (validate.mjs, PR checklist, data/games.json), centered 590px column with H1 at left=356 | `policyPage(games)` in build.mjs is now a separately written, player/publisher-facing page (What we list / What we never list / How we vet games / Your privacy / Questions) + a side list "Games listed now" with Made by / Licence / Source / Checked per game (anchors `#spud-fling`, `#pips-bloom-isle` kept). Standard `main.wrap` + `.page-intro` → left edge 80 at 1280 like every page. `mdToHtml` removed; CONTENT-POLICY.md stays in repo for contributors, no longer shipped to dist; `/CONTENT-POLICY.md` → 308 `/content-policy/`. |
| P1-2 | Policy H1 "Content policy — Toolstack Lab game hub" = 3 lines at 390 | H1 "Content policy" (1 line at 390); `.page-intro h1` drops to `--fs-xl` ≤480px. Title/JSON-LD unchanged (SEO). |
| P1-3 | `/about/` body 567px of 1120 (right half dead) + black `.about-slot` strip | Two-column `.page-cols` at ≥1000px: prose left + "How the hub works" cartridge→bay step diagram (dashed slots 1-2, docked solid 3, facts row: games / free / no account / no cookies). Stacks under the text on mobile. Black slot removed. |
| P1-4 | Pip at 390 after Play: touch stick/jump/dive cover level-menu Play; keyboard legend shows on touch | Game-side (cross-origin iframe) — **open / blocked-by-game-repo**, see below. |
| P2 | About illustration black strip | Removed (replaced by the theme-coloured how-it-works panel). |
| P2 | Detail: header `.btn` dark-green vs bay `.bay-play` fixed mint | One Play style: `.btn-play` (theme primary bg/ink, ▶ glyph, display face) on card Play, detail header Play and bay Play; bay is only larger. |
| P2 | Home hero half-width | `.hero-split` 2 columns at ≥900px: pitch left, "How it plays" panel right. Hidden <900 so cards stay high on phones. LCP unchanged (1.03 s live). |
| P2 | 19–26px touch targets (card titles, "Self-made · content policy", inline "content policy"/"gettoolstacklab.com") | `(pointer:coarse)`: card-title link block min-height 44; licence link inline-flex 44; inline prose links `padding-block:12px` (grows hit box, not line box — no layout shift). |
| P2 | Policy left edge | Fixed with P1-1 (h1 left = brand left at 1280). |
| — | Titles 61–64 chars | Left as is (SEO plan). |

## Reproducing checks (`polish/audit-round-4/r4_check.py`, interpreter `/workspace/.venv-pw/bin/python`)

| P1 | Check name | Baseline: live R3 (before deploy) | Local after | Live after |
|----|-----------|-----|-----|-----|
| 1 | `R4-policy-clean` (no literal md markers, no dev words) + `R4-left-edge` | FAIL (md `- ` lines, 13 dev words; h1 left 356 vs 80) | PASS | PASS |
| 2 | `R4-h1-2lines-390` | FAIL (3 lines) | PASS (1 line) | PASS |
| 3 | `R4-about-fill` (fill ≥85% or two-column) | FAIL (fill 0.507 @1280, 0.473 @1920) | PASS (2 cols, fill 1.0) | PASS |
| P2 | `R4-touch-44` (every link/button ≥44 tall, ≥24 wide at 390 touch) | FAIL (7 targets 19–26px) | PASS (0) | PASS (0) |
| P2 | `R4-one-play-style` | FAIL (system-ui dark green vs display mint) | PASS | PASS |

Evidence: baseline `polish/audit-round-4/baseline-live-r3/r4_check.json` (+ `baseline-live-r3.txt`), local `polish/audit-round-4/shots-final/r4_check.json`, live `polish/live-round-4/r4_check.json`. Each dir holds 7 pages × 390/768/1280/1920 × light/dark, fold + full screenshots.

P1-4 check: `polish/audit-round-4/pip/probe_pip.py` / `probe_pip_play.py` (overlap of #touch / #hint with menu Play) — live build FAILS, patched build PASSES (`live-probe.json`, `patched-probe.json`).

## Pip (P1-4) — diagnosis and outcome

- Lives in the game repo (`/workspace/exp28-games/game2`, live = `master` a7fd0ed): `body.touch #touch{display:block}` shows the stick/jump/dive over every menu (`#title`, `#pause`, `#cleared`, `#world2`, `#finish`), and `#hint` (keyboard legend) is never hidden on touch.
- No hub-only mitigation works: the game is a cross-origin iframe (hub cannot restyle it); even standalone at 390×844 the legend overlaps Play, a taller bay only shrinks the overlap. Live 364×560 overlaps stick+jump+dive; 390×844 overlaps hint.
- Game-side fix prepared, **not pushed, not deployed**: worktree `/workspace/exp28-games/game2-r4fix`, branch `hub-r4-pip-touch-menu`, commit `e1e8e67` "touch: hide stick/jump/dive while a menu is open; no keyboard legend on touch (hub R4 P1 #4)". Patch: `polish/audit-round-4/pip/0001-pip-touch-menu.patch`.
  - `src/main.js`: `syncMenu()` toggles `body.menu` when any of `#title/#pause/#cleared/#world2/#finish` is visible; called once at start and each `step()` before `readInput()`.
  - `src/style.css`: `body.touch.menu #touch{display:none}` and `body.touch #hint{display:none}`.
  - Verified on a local build (127.0.0.1:4877): no overlap at any probed size, after Play `{"menu":false,"touch":"block","hint":"none"}` (`patched-*.png`).
- Status: **OPEN — blocked by game repo.** Needs Lead to merge + deploy game2 to bloom-isle.gettoolstacklab.com.

## Gates

- Local: `/workspace/exp28-games/pipeline/reports/20261030-1413-gates-site/SUMMARY.md` — **PASS**, P0 0 / P1 0 / P2 41; LH mobile home 100/100/100/100 LCP 1.58 s CLS 0; detail 99/100/100/100 LCP 1.95 s CLS 0.
- Live: `/workspace/exp28-games/pipeline/reports/20261030-1417-gates-site/SUMMARY.md` — **PASS**, P0 0 / P1 0 / P2 34 (R3 live was 46); LH mobile home 100×4 LCP 1.03 s CLS 0; detail 100×4 LCP 1.32 s CLS 0.
- Live instant play + CSP: `polish/live-round-4/live_play_csp.json` — 0 console/CSP errors on 6 pages; iframe src set 58–83 ms after bay Play click (no motion gate).

## Scores (before = Playbook R3; after = self-scored, independent review pending)

| Dimension | Before | After | Note |
|-----------|--------|-------|------|
| Whitespace / layout | 3.8 | 4.3 | about/policy/home hero fill container; aligned left edge. Popular still short-page footer float (P2, untouched). |
| Visual consistency | 4.0 | 4.4 | one Play style; policy page uses the shared intro/column system. |
| Originality | 3.8 | 4.0 | how-it-works cartridge/bay diagram reused on home + About; modest. |
| Others (typo, hierarchy, colour, motion, micro, responsive) | 4.0–4.6 | unchanged, responsive 4.3 | responsive capped by open Pip overlap (game repo). |

## Open items

1. Pip touch controls / keyboard legend over menus — game repo branch `hub-r4-pip-touch-menu` @ e1e8e67 awaiting merge + deploy (not authorized here).
2. Remaining gate P2s (34 live): mostly inline-link/heuristic notes and 1920 bands; popular page short-page footer.
3. Detail 390: "Open in new tab" wraps onto its own row under Play/Copy link (pre-existing, P2).
