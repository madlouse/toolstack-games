# Game hub MVP — evidence summary

Asia/Shanghai timestamps from the evidence run that produced `pw-report.json` / Lighthouse JSON (`fetchTime` 2026-10-31 00:09+ UTC+8).

## Paths
- Site source: `/workspace/exp28-games/game-hub/`
- Static output: `/workspace/exp28-games/game-hub/dist/`
- Evidence: `/workspace/exp28-games/game-hub/evidence/`
- README: `/workspace/exp28-games/game-hub/README.md`

## Validate
- Pass: `evidence/validate-pass.txt` → `OK: 2 game(s) validated`
- Negative missing license: `evidence/validate-fail-missing-license.txt` → exit 1
- Negative missing source: `evidence/validate-fail-missing-source.txt` → exit 1
- Build: `evidence/build.txt` → home html+css+js ≈ 15 KB (well under 150 KB excl. thumbnails)

## Screenshots (Playwright)
Mobile 390×844 + desktop 1280×800 for home + both detail pages:
`evidence/screenshots/{mobile,desktop}-{home,spud-fling,pips-bloom-isle}.png`
Plus post-click play: `desktop-*-playing.png`

Game asset screenshots (live URLs, SwiftShader): `assets/games/*/screenshots/*.jpg|.webp` (3 each).

## Iframe play
| Game | Click loads iframe | Game origin HTTP | Pass |
|------|--------------------|------------------|------|
| Spud Fling | `https://tsl-game1.pages.dev/?internal=1` | 200 | True |
| Pip's Bloom Isle | `https://bloom-isle.gettoolstacklab.com/?internal=1` | 200 | True |

## Network / console
- Console errors: **0**
- Hub-only pages (before play): **no external requests** (`hub_only_external` all `[]`)
- After iframe play: game origins only, **plus** Cloudflare Web Analytics beacons edge-injected by the **game hosts** (`static.cloudflareinsights.com` / `cdn-cgi/rum`). Hub does not ship those. Games were not modified (brief forbids it). Embed uses `?internal=1` which skips the in-game JS beacon path; CF Pages/Workers HTML injection can still insert a beacon tag.

## Navigation timing (cache disabled, localhost `python -m http.server`)
| Page | DCL (ms) | load (ms) | resources transfer (B) | resource count |
|------|----------|-----------|--------------------------|----------------|
| home | ~18 | ~19 | 10320 | 2 |
| spud-fling | ~46 | ~46 | 65462 | 6 |
| pips-bloom-isle | ~49 | ~49 | 36436 | 4 |

(Home transfer here is CSS/JS-dominant; card thumbs are `loading=lazy` and may not all count in this short load sample. Lighthouse total-byte-weight below includes more.)

## Lighthouse (real run, not invented)
- Command used Playwright Chromium via `--chrome-path=.../chromium-1248/.../chrome`
- Mobile form-factor on `http://127.0.0.1:4173/`
- Scores from `evidence/lighthouse/home-mobile.json`: performance **1.0**, accessibility **1.0**, best-practices **1.0**, seo **1.0**
- Audits sample: FCP 1.0 s, TTI 1.3 s, total byte weight **47 KiB**
- Caveat: measured against local static server on loopback; production CDN/TTFB will differ. First attempt with `--preset=mobile` failed (CLI only allows perf/experimental/desktop); retried with `--form-factor=mobile`.

## Popularity seed
From `../analytics/TABLE-10-16_to_10-29.md`: Spud Fling visits **104**, Pip's Bloom Isle visits **10** (external, 14d). plays=0 unknown. Score = plays×3+visits → Spud first.

## Gaps / not blocking code, but deploy notes
1. **Not deployed** (brief: no push/deploy/DNS). `dist/` + root `vercel.json` ready for Vercel static.
2. **DNS / project** `games.gettoolstacklab.com` + GitHub `madlouse/toolstack-games` are orchestrator work.
3. **Game-host CF beacons** still appear inside the iframe; fixing requires game-host CF Web Analytics off or game HTML change (out of scope).
4. **UI polish** deferred — see `/workspace/exp28-games/hub/UI-POLISH-DIRECTIVE.md` (not run).
5. Parent `/workspace/exp28-games` was **not** git-committed; `git init` only inside `game-hub/`.
