# Round 1 self-audit — Toolstack Lab Game Hub

Date: 2026-10-31 (Asia/Shanghai). Spec: `../hub/UI-POLISH-DIRECTIVE.md` + Lead SEO extras. Standards: `polish/STANDARDS.md`.

**Core concept shipped:** Lab cartridge workbench — cards as labeled cartridges; hover crossfades a real screenshot; Play docks into a glowing play bay.

## Score table (1–5)

| Dimension | Before | After | Target | Notes |
|-----------|--------|-------|--------|-------|
| typography | 2.5 | 4.2 | ≥4.5 | Modular 1.25 scale, system stack only (no custom font). Body ~45–75ch on prose. Slightly short of 4.5 without a second display face. |
| whitespace | 2.5 | 4.3 | ≥4.5 | 4/8 tokens throughout; hero quieter. Featured + grid still a bit dense at 320. |
| visual_hierarchy | 3.0 | 4.5 | ≥4.5 | Hot cartridge featured; one primary Play per view. |
| color | 3.0 | 4.5 | ≥4.5 | Primary + accent + neutrals; `prefers-color-scheme` light/dark; AA after contrast fixes. |
| motion | 1.5 | 4.2 | ≥4.5 | Shared easing 150–360ms; skeleton; reduced-motion honored. No scroll-reveal (kept light). |
| micro_interaction | 1.5 | 4.3 | ≥4.5 | Hover preview, press, toast share, count-up, `/` search, Enter→Play. |
| responsive | 3.5 | 4.5 | ≥4.5 | 320/768/1280/1920 shot; ≥44px targets; play-bay AR stable on rotate (delta 0). |
| originality | 1.5 | 4.0 | ≥4 | Cartridge dock is memorable and cheap; still lighter than award-site metaphors. |

**Average after:** ~4.31. **Targets unmet:** typography 4.2, whitespace 4.3, motion 4.2, micro 4.3, originality 4.0 (meets originality floor ≥4).

## What changed

- `polish/STANDARDS.md` — 8 dimensions × 3 real award URLs + principles; cartridge concept.
- `src/site.css` — tokens (type, 4/8 space, motion), light/dark, cartridge card notch, featured band, play bay, skeleton, toast, board, FAQ, focus.
- `src/site.js` — filter/search, `/` + Enter, toast share/copy, count-up, iframe skeleton, recent plays.
- `build.mjs` — `/popular/`, `/about/`, enriched detail (how-to, keyboard/touch controls, tips, similar genres, FAQ, license); JSON-LD VideoGame + BreadcrumbList + FAQPage; home ItemList + CollectionPage; unique title/desc/canonical/OG.
- `data/games.json` — tips, FAQ, similarGenres, howToPlay, controlsKeyboard/Touch, schema fields (facts from game1 DESIGN.md + game2 README).

Home weight excl images: **39130 B** (under ~60KB).

## Measured (local, after P0/P1 fixes)

Source: `polish/audit-round-1/`.

| Metric | Value |
|--------|-------|
| Lighthouse mobile performance | 1.0 |
| Lighthouse accessibility | 1.0 (was 0.96 before contrast fix) |
| Lighthouse best-practices | 1.0 |
| Lighthouse SEO | 1.0 |
| FCP | 902 ms |
| LCP | 1202 ms |
| CLS | 0 |
| TBT | 0 ms |
| axe-core (Playwright inject) | 0 violations on home/detail/popular/about × light+dark |
| `/` focuses search | yes |
| Tab→Play→Enter opens game | yes (`/games/spud-fling/#play`) |
| reduced-motion preview opacity | 0 (static) |
| play iframe Spud | `https://tsl-game1.pages.dev/?internal=1` |
| play iframe Pip | `https://bloom-isle.gettoolstacklab.com/?internal=1` |
| orientation AR delta | 0.0 after min-height removal |

Screenshots: `polish/audit-round-1/{home,spud,pip,popular,about,404}-{320,768,1280,1920}.png`.

## Gap list

### Before → fixed in-round (P0/P1)

| Sev | Dim | Gap | Fix |
|-----|-----|-----|-----|
| P0 | color | Light primary `#0f9f6e` on white btn text ~3.38:1 | Darkened to `#086648` (~7:1) |
| P0 | color | Play placeholder muted on always-dark bay ~3.69:1 in light UI | Fixed bay text to `#b7c4d6` |
| P1 | responsive | Play bay `min-height:280` broke AR on 390 portrait (1.3 vs 1.6) | Removed min-height; AR delta 0 |
| P1 | a11y | `allowfullscreen` + `allow=fullscreen` console warning | Dropped `allowfullscreen` attr |

### Remaining after Round 1

| Sev | Dim | Gap |
|-----|-----|-----|
| P1 | typography | Still one system stack — no self-hosted display face; score 4.2 &lt; 4.5 |
| P1 | originality | Cartridge metaphor is CSS-only; could strengthen dock animation / empty-bay graphic without weight |
| P2 | whitespace | 320px featured + filters feel tight |
| P2 | motion | No enter/stagger for cards (intentionally light); score 4.2 |
| P2 | micro | Card `tabindex=0` + nested links is a slight SR verbosity tradeoff |
| P2 | SEO | Similar-games section describes genres honestly but has few on-site link targets (only 2 games) |

No remaining **P0**. One **P1** typography / originality polish left for later rounds.

## Honesty / not verified this round

- Real-device 4G field LCP not measured (lab Lighthouse only).
- Live deploy + live Lighthouse recorded after push in `polish/live-round-1/` (see that folder once deploy completes).
- Independent Agent review (directive step 5) not run in Round 1.
