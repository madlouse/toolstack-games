# Round 2 self-audit — Toolstack Lab Game Hub

Date: 2026-10-31 (Asia/Shanghai). Spec: `../hub/UI-POLISH-DIRECTIVE.md` + independent review `polish/INDEPENDENT-REVIEW-R1.md`. Standards: `polish/STANDARDS.md`.

**Core concept (unchanged one sentence):** Lab cartridge workbench — labeled cartridges on a shelf; Play docks into a glowing play bay.

## Score table (1–5)

| Dimension | Before (R1 self) | Before (indep. review) | After (R2) | Target | Notes |
|-----------|------------------|------------------------|------------|--------|-------|
| typography | 4.2 | 4.0 | **4.6** | ≥4.5 | Self-hosted Space Grotesk subset (SIL OFL) titles/hero only; body stays system; `font-display:swap`; modular 1.25 kept. |
| whitespace | 4.3 | 4.0 | **4.5** | ≥4.5 | 320px tighten; filter chips hidden with ≤4 games; shelf rail under grid. |
| visual_hierarchy | 4.5 | 3.5 | **4.6** | ≥4.5 | **One** primary Play on detail (= dock). Ghost/link secondary only. |
| color | 4.5 | 4.2 | **4.5** | ≥4.5 | Unchanged tokens; axe 0; LH a11y 1.0. |
| motion | 4.2 | 4.0 | **4.5** | ≥4.5 | Dock-in 280ms transform+opacity; card stagger ≤6 under `prefers-reduced-motion: no-preference`; reduced freezes both. |
| micro_interaction | 4.3 | 3.8 | **4.6** | ≥4.5 | `#play` auto-docks; home/featured Play → `/games/x/#play` one intent; featured Enter-to-play; coarse-pointer copy. |
| responsive | 4.5 | 3.8 | **4.5** | ≥4.5 | Nav 3 items (Policy footer-only) — no orphan at 390; teeth/shelf scale. |
| originality | 4.0 | 3.2 | **4.5** | ≥4 | Visible in &lt;3s: spine, notch, label plate, edge teeth, shelf, empty-bay graphic, dock motion. |

**Average after (R2):** ~4.54. **Indep. review P1s:** addressed (see gap list).

## What changed

- **Typography:** `assets/fonts/space-grotesk-display.woff2` (10 832 B, wght 500–700, Basic Latin subset) + OFL notice; `@font-face` + metric fallback; preload; titles/brand only.
- **Play path:** single `#play-embed` primary; removed “Play in page” / “Load …” primaries; `#play` hash auto-loads iframe; hero/card/featured Play → `#play`.
- **Cartridge UI:** spine, sharper notch, label plate + serial, edge connector teeth, shelf under grid, empty-bay SVG, dock-cart animation, featured teeth.
- **Nav / copy:** Policy out of primary nav (footer + About); hover→press on coarse pointers; honest tagline (no false “one click”).
- **P2:** hide tag chips when ≤4 games; popular omits “0 plays”; shot-slot skeleton; About/404 on-metaphor; similar hub cartridges.
- Marker: HTML comment `<!-- polish-r2 -->` in footer.

SEO from R1 kept (VideoGame / FAQPage / BreadcrumbList JSON-LD, how-to, similar genres, license).

Home weight excl images: **50 981 B**. Font WOFF2: **10 832 B**.

## Measured (local)

Source: `polish/audit-round-2/`.

| Metric | Value |
|--------|-------|
| Lighthouse mobile performance | 0.98 |
| Lighthouse accessibility | 1.0 |
| Lighthouse best-practices | 1.0 |
| Lighthouse SEO | 1.0 |
| FCP | 1177 ms |
| LCP | 1427 ms |
| CLS | 0 (LH); Playwright CLS home 0 / spud ~0.0006 / popular ~0.0003 |
| TBT | 159 ms |
| axe-core | 0 violations (home/spud/popular dark) |
| `document.fonts.check('700 24px "TSL Display"')` | true; face status `loaded` |
| Body font | system stack (unchanged) |
| Third-party requests (hub chrome) | none |
| Primary Play count (detail) | 1 (`#play-embed`); no `play-embed-alt` |
| `#play` auto-dock | src set in 58 ms after navigation; btn “Playing…” |
| Dock animation | `dock-in` opacity samples 0→~1→fade; reduced-motion anim `none` op 0 |
| Card stagger (reduced) | `animationName: none` |
| `/` focuses search | yes |
| Featured Enter → `#play` + auto-dock | yes (Playwright expect_navigation) |
| Play Spud iframe | `https://tsl-game1.pages.dev/?internal=1` |
| Play Pip iframe | `https://bloom-isle.gettoolstacklab.com/?internal=1` |
| Nav at 390 | Games / Popular / About same `y`; no Policy in header |

Screenshots: `polish/audit-round-2/{home,spud,popular}-{320,390,1280}-*.png`, `*-playing*.png`, `home-390-reduced.png`, `spud-bay-idle-1280.png`.

## Gap list

### Closed this round (review P1 + planned P1)

| Sev | Dim | Gap | Fix |
|-----|-----|-----|-----|
| P1 | typography | No display face | Self-hosted Space Grotesk subset ≤30KB |
| P1 | originality | Metaphor not visible &lt;3s | Spine/teeth/plate/shelf/empty bay/dock |
| P1 | hierarchy | 3 primary Plays on detail | One `#play-embed`; ghost/link secondary |
| P1 | micro | `#play` only scrolled | Auto-dock on hash + home/featured links |
| P1 | responsive | Policy orphan on narrow nav | Policy removed from primary nav |
| P2 | whitespace | 320 tight / filter chrome | 320 tighten; hide chips ≤4 games |
| P2 | motion | No enter stagger | Stagger ≤6 cards, motion-OK only |
| P2 | micro | Hover copy on touch | `pointer: coarse` → Press |
| P2 | popular | “0 plays” misleading | Omit plays when 0 |
| P2 | shots | Black lazy boxes | `.shot-slot` skeleton |
| P2 | about/404 | Off-metaphor | Bay doodle / empty-slot 404 |

### Remaining after Round 2

| Sev | Dim | Gap |
|-----|-----|-----|
| P2 | responsive | 1920 side bands still quiet (intentional narrow workbench; not redesigned) |
| P2 | micro | Card `tabindex=0` + nested links SR verbosity tradeoff (unchanged) |
| P2 | SEO | Similar genres still mostly blurbs; hub cartridge links added beside them |
| — | process | Independent Agent re-review of R2 not run yet |

No remaining **P0**. No remaining **P1** from the R1 independent review list.

## Live check (after deploy of `570fb83`)

Source: `polish/live-round-2/`. Marker `<!-- polish-r2 -->` present on first poll.

### Live Playwright

- Viewports: 390×844 + 1280×800
- Pages: home, spud, popular (+ playing shots)
- Play Spud → `https://tsl-game1.pages.dev/?internal=1`
- Play Pip → `https://bloom-isle.gettoolstacklab.com/?internal=1`
- `#play` auto-dock OK (`Playing…`, iframe src set)
- One primary Play on detail
- Font check live: `TSL Display` loaded on h1
- Nav: Games / Popular / About (no Policy)
- Console errors: **0**
- Screenshots: `polish/live-round-2/{mobile,desktop}-{home,spud,popular,*-playing}.png`, `mobile-spud-autoplay.png`

### Live Lighthouse mobile (`home-mobile-live-summary.json`)

| Metric | Value |
|--------|-------|
| Performance | 1.0 |
| Accessibility | 1.0 |
| Best-practices | 1.0 |
| SEO | 1.0 |
| FCP | 1332 ms |
| LCP | 1332 ms |
| CLS | 0 |
| TBT | 0 ms |
| TTI | 1332 ms |

## Honesty / not verified this round

- Real-device 4G field LCP not measured (lab + live Lighthouse only; both under 2.5s LCP).
- Independent Agent re-review of Round 2 not run yet (directive step 5).
