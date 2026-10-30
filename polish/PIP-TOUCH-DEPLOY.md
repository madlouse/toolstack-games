# Pip touch-menu patch: merge + deploy (2026-10-30)

## What shipped
- Game repo: `/workspace/exp28-games/game2` (local git, **no remote**; worktrees `game2-r4fix`, `game2-w2`).
  Live `tsl-game2` was byte-identical to a build of `master` @ `a7fd0ed` (index-Caz8sSOV.js), so `master` is the deploy branch
  (`cg-polish` / `cg-world2` are separate CrazyGames lines, not live).
- Fix commit `e1e8e67` ("touch: hide stick/jump/dive while a menu is open; no keyboard legend on touch") from branch
  `hub-r4-pip-touch-menu`, identical to `audit-round-4/pip/0001-pip-touch-menu.patch`.
- Merge: fast-forward `master a7fd0ed..e1e8e67` (`git fetch . hub-r4-pip-touch-menu:master`). No merge commit, no force, nothing pushed (no remote).
- Diff review: `src/main.js` +10 (syncMenu() toggles `body.menu` when title/pause/cleared/world2/finish is open; called once at
  load and every `step()`), `src/style.css` +3 (`body.touch.menu #touch{display:none}`, `body.touch #hint{display:none}`).
  Only `body.touch` rules → desktop (no touch) unaffected. No network, no new deps, no third-party code.
  Gap (pre-existing path, low impact): `step()` is skipped while paused, so if a hybrid touch+keyboard device opens Pause (Esc)
  `body.menu` is not set until resume. Touch-only players have no pause trigger on `master`.

## Tests (before deploy, sequential, merged tree)
- `tests/selftest.py` against the vite build: high / low / low-webgl1 / auto — **ALL PASS** (no console errors).
- `npx playwright test tests/world1.spec.js` (vite dev :43123, chrome channel): **2/2 passed** (controls/onboarding/lock/save; no console errors low=0/low=1).
- No flaky failures; no reruns needed.

## Deploy
- Method: existing `cf` CLI (`cloudflare.config.ts`, worker `tsl-game2`, domain `bloom-isle.gettoolstacklab.com`, workers.dev on),
  `npx cf deploy --dry-run` then `npx cf deploy` with the env token (never printed). Clean detached worktree of `master` @ `e1e8e67`.
- Time: 2026-10-30 14:29:21–14:29:34 EDT. Version ID `acb13902-5e3f-4126-868f-5e466286e45b`.
  3 files uploaded (index.html, index-RJLsaOJ5.css, index-BCwhVT4w.js); both hosts serve the new bundle.

## Live verification (Playwright, chromium swiftshader)
Script: `polish/live-round-5/pip/live_pip_touch.py`. Results JSON + screenshots (moved off-repo, see EVIDENCE-LOCATION.md):
`/workspace/exp28-games/game-hub-evidence/polish/live-round-5/pip/`
- 390x844 hasTouch+isMobile, hub `/games/pips-bloom-isle/#play` (iframe `bloom-isle…/?internal=1`) and direct host:
  title menu → `body.menu` set, stick/jump/dive hidden, menu Play visible and not overlapped by any control box,
  keyboard legend hidden; after tapping Play → controls visible, legend still hidden. (In-level jump box 244,434 96x96 would
  overlap the menu Play box 109,457 146x68 in the hub iframe — the original bug.)
- 1280x800 desktop, hub + direct: legend visible in menu and level, touch controls hidden, Play starts level, W moves player 5–6 m.
- 48/50 checks pass. The 2 failures are a **pre-existing** bug, not from this patch: `ReferenceError: t is not defined` on any
  touchstart on the title screen (`if (!started && t.target === canvas)` outside the `for (const t …)` loop, since 8467fa7).
  Play still works (click fires); tap-on-canvas-to-start does not. Already fixed on `cg-polish` (`e.target`), not on `master`.

## Covers
- `python3 scripts/check-covers.py`: PASS (Pip thumb diff 2.2, cover 1.7; Spud PASS). Live hub og/thumb/cover == repo files.
- Mismatch: the game's own `og:image` `https://bloom-isle.gettoolstacklab.com/og.png` is an old pre-World-1 frame with the old
  copy "Find 12 sunseeds, wake the Sky Bloom" (meta descriptions say the same); the hub uses the current Tansy frame.
  Not changed (needs new art + copy + a redeploy). Compare: `og-compare-game-top-hub-bottom.png` in the evidence dir.
