# Polish standards — Toolstack Lab Game Hub

Round-1 bar for https://games.gettoolstacklab.com/. Benchmarks are Awwwards / Webby / FWA winners used only for **principles**, never layout/copy/assets.

**Core originality concept (one sentence):**  
Games are **lab cartridges on a workbench** — each card is a labeled cartridge face; hover crossfades real screenshots like flipping a cartridge label; Play docks the cartridge into a glowing **play bay** that becomes the iframe stage.

---

## 1. Typography

**Excellent bar:** ≤2 families (system stack OK); modular type scale with clear H1→body steps; body line-length ~45–75ch; Chinese/English mix shares one baseline rhythm; no decorative display font that fights game cover art.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Pangram Pangram Foundry (Awwwards E-Commerce of the Year / SOTD) | https://pangrampangram.com/ | Type hierarchy does the navigation — scale and weight, not chrome. |
| Bézier (Webby 2025 Best Visual Design – Function) | https://www.bezier.com/en | Functional type: every size earns a job (label, lead, body). |
| Google Fonts redesign (Webby 2024 Best User Interface) | https://fonts.google.com/ | Dense catalogue still scannable when the scale is modular and muted. |

## 2. Whitespace

**Excellent bar:** All spacing on a 4/8 grid; card gaps equal; hero breathes but Play stays above the fold on 1280; density rises only where content is denser (prose, FAQ).

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Cowboy (Webby 2024 Best Visual Design – Function) | https://cowboy.com/ | Product pages use large quiet zones so the primary CTA is unambiguous. |
| Apple.com (long-running Webby / industry reference for retail polish) | https://www.apple.com/ | One idea per band; whitespace is the hierarchy. |
| Stripe.dev (Awwwards Site of the Day) | https://stripe.dev/ | Technical density still feels calm when section padding is consistent. |

## 3. Visual hierarchy

**Excellent bar:** In ≤3 seconds a visitor knows “this is a game collection,” which title is hottest, and where Play is; **one** primary button per view; hot game gets a featured cartridge slot.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Lando Norris (Awwwards Site of the Year 2025) | https://landonorris.com/ | One heroic focal object, then supporting cards — not equal tiles. |
| Igloo Inc (Awwwards Site of the Year 2024) | https://igloo.inc/ | Scroll reveals depth, but the first screen already states the brand. |
| Linear (industry product-UI reference; dense but ordered) | https://linear.app/ | Primary action stays singular; secondary actions recede. |

## 4. Color

**Excellent bar:** 1 primary + 1 accent + neutral ramp; dark **and** light (`prefers-color-scheme`) both ≥4.5:1 text; covers stay dominant — UI chrome never fights thumbnail hues.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Lando Norris (Awwwards SOTY 2025; palette ~#D2FF00 on #111112) | https://landonorris.com/ | One loud accent on near-black neutrals beats rainbow chrome. |
| Cowboy (Webby 2024) | https://cowboy.com/ | Neutrals carry structure; accent is reserved for action. |
| Bézier (Webby 2025) | https://www.bezier.com/en | Soft neutrals let product imagery own the color story. |

## 5. Motion

**Excellent bar:** Shared easing + duration tokens (150–400ms); enter/hover/transition feel related; iframe area shows a skeleton, never a blank void; **no** motion delays click-to-play; only `transform`/`opacity`; `prefers-reduced-motion: reduce` freezes non-essential motion.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Lusion v3 (Awwwards Site of the Year 2023) | https://lusion.co/ | Motion is continuous storytelling — but our budget forbids heavy 3D; keep the *unity* of easing, drop the weight. |
| Opal Tadpole (Awwwards E-commerce of the Year 2024) | https://www.awwwards.com/sites/opal-tadpole | Product motion stays short and purposeful around the CTA. |
| Active Theory lineage / FWA craft (see Bruno Simon below) | https://bruno-simon.com/ | Feedback motion should confirm the action, not decorate the idle page. |

## 6. Micro-interaction

**Excellent bar:** Card hover/focus preview (screenshot crossfade, no video); button press scale; copy-link toast (no modal); popularity count-up (transform/opacity-safe); `/` focuses search/filter; Enter opens focused card.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Bruno’s Portfolio (FWA of the Year 2025) | https://bruno-simon.com/ | Interaction itself is the product identity — for us, cartridge flip + dock. |
| A 3D Game-Like Portfolio (FWA of the Day 2025-03-01) | https://thefwa.com/cases/a-3d-game-like-portfolio | Game-like feedback without blocking the path to content. |
| Codrops Fan Museum (FWA of the Day 2025-06-11) | https://thefwa.com/cases/codrops-fane-museum | Small, delightful object metaphors beat generic hover shadows. |

## 7. Responsive

**Excellent bar:** Verified at 320 / 768 / 1280 / 1920; touch targets ≥44px; game page play bay keeps aspect ratio on orientation change (no layout jitter); nav always discoverable.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Cowboy (Webby 2024 + Best Mobile UI nominee) | https://cowboy.com/ | Mobile CTA size and thumb reach match desktop intent. |
| Google Fonts redesign (Webby 2024 Best UI) | https://fonts.google.com/ | Filters and grids reflow without losing scan order. |
| Apple.com | https://www.apple.com/ | Breakpoints change density, not the story. |

## 8. Originality

**Excellent bar:** A memorable, cheap-to-ship concept stated in one sentence (see top); not a generic Bootstrap/Tailwind gallery; concept visible on home + detail without copying any award site.

| Benchmark | URL | Principle learned |
|-----------|-----|-------------------|
| Bruno’s Portfolio (FWA of the Year 2025) | https://bruno-simon.com/ | One metaphor (driveable CV) makes the site unforgettable. |
| The Museum of Digital Influence (FWA of the Day 2025-04-07) | https://thefwa.com/cases/the-museum-of-digital-influence | Framing content as “exhibits” gives navigation meaning. |
| Igloo Inc (Awwwards SOTY 2024) | https://igloo.inc/ | A single world metaphor unifies motion, color, and hierarchy. |

---

## Non-negotiables (above polish)

- Instant play path; motion never delays Play.
- Mobile LCP ≤2.5s, CLS ≤0.1; transform/opacity only.
- Contrast ≥4.5:1; keyboard + visible focus; reduced-motion honored.
- No award-site cloning; only self-made / clearly licensed games.
- No heavy video/3D backgrounds; no modals interrupting play; discoverable nav.
- Pip’s Bloom Isle: link/embed only; no invented features; 13+ casual; never mention CrazyGames.
