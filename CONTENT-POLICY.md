# Content policy — Toolstack Lab game hub

This hub only lists games that are safe to host, embed, and redistribute commercially.

## Allowed origins

A game may appear here only if **all** of the following are true:

1. **Ownership / licence fits one of:**
   - **Self-made** by Toolstack Lab (or an author who granted us rights), or
   - **Public domain** (`CC0-1.0` or equivalent PD dedication), or
   - **Permissive open-source** with an explicit licence that permits **commercial use, modification and embedding**: `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Zlib`, `CC-BY-4.0` (check the exact text; the allowlist lives in `validate.mjs`).
   - **Not allowed for now:** copyleft (GPL, AGPL, LGPL, MPL/EPL, CC-BY-SA / ShareAlike), NonCommercial (`NC`), NoDerivatives (`ND`), and anything with an unknown or unread licence.
2. **Provenance is recorded** in `data/games.json`:
   - `license` — SPDX id from the allowlist, or `self-made`
   - `licenseUrl` — `https://` proof URL (for self-made: this hub's `/content-policy/#<slug>`; for third-party: the upstream LICENSE file, pinned to a commit where possible)
   - `source` — `self-made by Toolstack Lab`, or the upstream repo `https://` URL (`sourceCommit` optional)
   - `author` (+ optional `authorUrl`) — the real original author; never Toolstack Lab for a third-party game
   - third-party only: `licenseEvidence {url, quote, checked}` (the licence text we actually read, and when), `copyrightNotice` (the notice MIT/BSD/Apache/Zlib/CC-BY require us to keep; not needed for CC0), `modifications` (what we changed, e.g. "removed Google Analytics"; `None` if nothing), optional `shelf: "classics"`
   - The game page and the content-policy page render these credits from the data (`build.mjs`), so the published text always matches the record.
3. **No trademark or asset infringement.** We do not copy characters, levels, art, sounds, logos or brand names we have no rights to. **Clearly-licensed open-source classics are allowed** (for example an MIT-licensed 2048 on a "Classics" shelf), but only the code/assets the licence covers, and the **name must not pose as official**: credit the original author, say it is an independent copy, and do not use another company's product name or branding as if it were ours. "Inspired by a mechanic" is fine.
4. **Embedding.** If `embed: true`, the upstream must allow framing / embedding on a third-party origin (or we host a copy we control). A third-party game is always served from **its own origin** (a separate subdomain or `*.pages.dev`), never same-origin with the hub, inside a sandboxed iframe; `vercel.json` CSP `frame-src` adds only that origin. Otherwise set `embed: false` and link out only.
5. **Site copy stays true.** The hub brand stays "Free 3D Browser Games". While every game is self-made the site says so; once a classic is listed, About/home switch to "mostly 3D, plus a few selected classics" automatically (`build.mjs`).

## Build gate

`validate.mjs` **fails the build** (`node build.mjs` runs it first) when any of these is true. Do not bypass it.

- A required field is missing or empty (`license`, `licenseUrl`, `source`, `author`, … — see `REQUIRED` in the script).
- `license` is not on the allowlist: `self-made`, `CC0-1.0`, `MIT`, `BSD-2-Clause`, `BSD-3-Clause`, `Apache-2.0`, `Zlib`, `CC-BY-4.0` (SPDX ids). Copyleft (GPL, AGPL, LGPL, MPL/EPL, CC-BY-SA), NonCommercial (`NC`), NoDerivatives (`ND`) and unknown licences fail with the reason.
- `licenseUrl` is not a valid `https://` URL. `n/a` is no longer accepted.
- A third-party game (anything not `self-made`) lacks `licenseEvidence {url, quote, checked}`, `copyrightNotice` (not needed for CC0), `modifications`, or an `https://` `source`; or its `licenseUrl` points at this hub instead of the upstream proof.
- An `embed: true` game's origin is not in the `frame-src` of the `Content-Security-Policy` in `vercel.json` (`'self'` for a same-origin `/play/…` path), or a third-party game would be served same-origin with the hub (third-party games get their own origin).
- A forbidden field is present (ratings/reviews, analytics/tracking/ads ids, cookies, personal data), or an unknown field (typo guard).

`node validate.mjs --check-urls` additionally fetches every licence, proof and source URL (HEAD, GET fallback). Each rule has a failing fixture in `test/fixtures/`; `node test/validate-fixtures.mjs` (`npm test`) proves they fire.

## Screenshots and art

Hub screenshots and Open Graph images must come from the game itself (captured frames) or from assets we own. Do not scrape third-party store art.

## Privacy

Listed games should not require accounts or collect personal data for basic play. The hub itself uses no cookies, no third-party scripts, and no analytics beacons in this MVP. We count visits with Cloudflare's cookie-free Web Analytics (no cookies, no personal profiles); that beacon runs only inside our own games, on their own origins, never on hub pages.

## Changes

When adding a game, update `data/games.json`, capture screenshots, re-run `node validate.mjs && node build.mjs`, and keep this policy in the PR description checklist.
