# Content policy — Toolstack Lab game hub

This hub only lists games that are safe to host, embed, and redistribute commercially.

## Allowed origins

A game may appear here only if **all** of the following are true:

1. **Ownership / licence fits one of:**
   - **Self-made** by Toolstack Lab (or an author who granted us rights), or
   - **Public domain** (CC0 or equivalent PD dedication), or
   - **Open-source** with an explicit licence that permits **commercial use and embedding** (for example MIT, Apache-2.0, BSD-2/3, zlib — check the exact text).
2. **Provenance is recorded** in `data/games.json`:
   - `license` — short label (e.g. `self-made`, `MIT`, `CC0`)
   - `licenseUrl` — proof URL, or the literal string `n/a (self-made)`
   - `source` — repo / origin URL, or `self-made by Toolstack Lab`
3. **No unattributed classics.** Ports or remakes of well-known arcade/console games are not allowed unless we hold clear rights or a permissive licence covering that content. "Inspired by a mechanic" is fine; copying characters, levels, or branding is not.
4. **Embedding.** If `embed: true`, the upstream must allow framing / embedding on a third-party origin (or we host a copy we control). Otherwise set `embed: false` and link out only.

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

Listed games should not require accounts or collect personal data for basic play. The hub itself uses no cookies, no third-party scripts, and no analytics beacons in this MVP.

## Changes

When adding a game, update `data/games.json`, capture screenshots, re-run `node validate.mjs && node build.mjs`, and keep this policy in the PR description checklist.
