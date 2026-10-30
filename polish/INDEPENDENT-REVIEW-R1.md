# Independent UI / interaction review — Round 1

- **Site:** https://games.gettoolstacklab.com/
- **Reviewer:** Builder Playbook (did not build the hub)
- **Standards:** `/workspace/exp28-games/hub/UI-POLISH-DIRECTIVE.md` + `/workspace/exp28-games/game-hub/polish/STANDARDS.md`
- **Method:** Live pages + provided screenshots under `polish/live-round-1/` and `polish/audit-round-1/`. Did **not** read Engineer self-scores (`ROUND-1.md` / `ITERATION-LOG.md`). Own mobile Lighthouse on home: `hub/review/evidence-r1/lighthouse-home-mobile.json`.
- **Date:** 2026-10-31 (Asia/Shanghai)

## Verdict

**Not closed.** Below the ≥4.5 bar on most dimensions; **originality &lt; 4**. **No P0.** Several **P1** gaps. Performance / a11y **floor metrics pass** on home; play-path clarity still fails the written “one click / one primary button” bar.

## Scores (1–5)

| Dimension | Score | Notes (evidence, not author claims) |
|-----------|------:|-------------------------------------|
| typography | **4.0** | System UI + mono (=2 families). Modular 1.25 scale, `prose` ~62ch, CJK fallbacks. Clear but ordinary; hero title restates the brand line rather than earning a stronger display step. |
| whitespace | **4.0** | Spacing tokens on 4/8 grid; cards breathe. Popular / About / 404 feel over-empty with only two titles; filter chrome is heavy relative to catalog size. |
| visual_hierarchy | **3.5** | ≤3s: “AI 3D game shelf + Play” is readable; featured “Hot cartridge” works. **Fails “one primary button”:** game pages expose hero **Play**, bay **Play in page**, and bay **Load …** as three parallel primaries. |
| color | **4.2** | One primary + one accent + neutrals; light/dark tokens. Own contrast spot-checks: text 16.5:1, muted ~5.0–5.5:1, primary button ~7:1, accent link ~4.8–5.2:1 on light bg. Covers stay dominant. |
| motion | **4.0** | Shared `--ease` / 150–360ms; transform/opacity transitions; play skeleton + shimmer; thorough `prefers-reduced-motion`. Motion is competent, not a signature. |
| micro_interaction | **3.8** | Card preview crossfade CSS, btn press scale, copy/share toast, count-up, `/` + Enter on `.card`. Gaps: `#play` does not auto-dock; featured block is not in the Enter-to-play card path; hero copy says “Hover…” on touch viewports. |
| responsive | **3.8** | Checked artifacts at 320 / 768 / 1280 / 1920 + live mobile/desktop shots. `.btn` / nav / filters `min-height: 44px`. Narrow header wraps so **Policy** often sits alone on a second row. `--max: 1120px` leaves large unused side bands at 1920 without a deliberate large-type composition. Landscape play-bay stability not fully re-proven beyond the audit still. |
| originality | **3.2** | Standards sentence (“lab cartridges on a workbench / play bay dock”) is clear in About + kicker copy. Live chrome still reads as a polished **generic** game directory (white cards, pill tags, sticky nav). Cartridge “notch” / bay glow are subtle — not a memorable interaction people can name after one visit without reading About. **Below originality ≥4.** |

**Target:** all ≥4.5 and originality ≥4 → **miss**.

## Floor (above polish)

| Check | Result | Evidence |
|-------|--------|----------|
| Mobile LCP ≤2.5s | **Pass** | Own LH mobile home: LCP **1458ms**, FCP 1458ms, perf score 1.0 |
| CLS ≤0.1 | **Pass** | Own LH CLS **0** |
| Contrast ≥4.5:1 (UI text) | **Pass** (token check) | Light/dark CSS vars spot-checked above; LH a11y category **1.0**, no color-contrast audits failing |
| Keyboard + visible focus | **Pass** | Global `:focus-visible` outline; skip-link; `/` focuses search; cards `tabindex="0"` + Enter → Play |
| `prefers-reduced-motion` | **Pass** | Global kill-switch + card/preview/skeleton/toast overrides in `site.css`; JS skips count-up animation |
| Instant play path / motion must not delay Play | **Partial** | Iframe loads only after click (good for LCP). But path is **list → detail → Load**; hero markets “play in one click”. Hash `#play` only scrolls — does not call `load()`. |
| No award-site cloning / only licensed games | **Pass** (as shown) | License blocks claim self-made; no third-party award layout copy observed |

## Gap list

### P0
_None._ Floor metrics on home clear; games can be loaded and played after the intentional click-to-dock.

### P1
1. **Multiple primary Play controls on detail** — Hero `Play` (`#play`), bay `Play in page`, and `Load {Game}` are three green/primary actions for one job. Violates directive “主按钮只有一个” and slows recognition of the dock action. *(Spud/Pip live pages + screenshots.)*
2. **“One click” claim vs real path** — Home pitch: “play in one click.” Actual: navigate to game page, then click Load / Play in page. `#play` does not auto-load the iframe. Conflicts with boundary #1 / marketing honesty. *(home HTML + `site.js` `wirePlay`.)*
3. **Originality below bar** — Cartridge workbench is explained, not embodied at award strength. First impression ≈ clean SaaS gallery. Need one unmistakable visual/interaction beat on home + bay (without copying award sites).
4. **Narrow nav wrap** — At ~320–390px, Games/Popular/About/Policy wrap; Policy often orphaned. Hurts scan and touch rhythm. *(mobile-home / home-320.)*

### P2
0. **Screenshot slots look black before lazy images load** — all screenshot files return 200 and are real captures (second-pass check), so this is a lazy-load capture artifact, not missing assets. Still, `.shots figure` shows a near-black box until load; use a skeleton/placeholder. Also: the three Spud screenshots are near-identical bright-green scenes, alt text is generic.
1. Popular board shows **“0 plays”** next to visit-based scores — undermines “hot” story.
2. **Similar games** are genre blurbs, not cartridges — metaphor breaks mid-page.
3. Hero still teaches **hover** flip on mobile screenshots — prefer press/focus language on coarse pointers.
4. **Ten filter chips for two games** — chrome denser than catalog.
5. **404 / About** are clean but off-metaphor (generic empty states).
6. **1920** unused side space — either embrace a wider workbench composition or accept this as intentional and document it; today it reads unfinished, not deliberate.

## What already works (keep)

- Deferred iframe + skeleton is the right perf pattern; own LH LCP 1.5s / CLS 0.
- Tokenized type, space, color, motion; dark/light; reduced-motion; focus-visible; 44px targets.
- Featured hot cartridge + popularity sort link; copy-link toast; `/` filter tip.
- License / source blocks on game pages; Pip age boundary called out on About.

## Closeout check (directive §6)

| Gate | Status |
|------|--------|
| 8 dims ≥4.5 (originality ≥4) | **Fail** |
| Independent review no P0/P1 | **Fail** (P1s above) |
| Perf + a11y floor | **Pass** (home metrics; play-path honesty still P1) |

**Recommendation:** Round 2 — collapse to **one** primary dock control, make `#play` (or home Play) complete the dock without a second guess, raise the cartridge metaphor into something visible in &lt;3s without About, fix nav wrap. Re-review after that; max 5 rounds.

## Correction (R1, 00:35)
Earlier draft listed black screenshot slots as P1 #5. A second evidence pass shows all screenshot assets load (HTTP 200, real gameplay), so it is downgraded to P2 #0. Second Lighthouse run: LCP 1.0s, perf/a11y/BP/SEO 100, CLS 0 (my run: LCP 1.5s). Floor still passes.

## Evidence index

- Live: `/`, `/games/spud-fling/`, `/games/pips-bloom-isle/`, `/popular/`, `/about/`, 404
- Screens: `polish/live-round-1/*`, `polish/audit-round-1/*`
- CSS/JS: live `site.css` / `site.js` (also under `game-hub/src/`)
- Own LH: `/workspace/exp28-games/hub/review/evidence-r1/lighthouse-home-mobile.json`
