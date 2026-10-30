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

`validate.mjs` **fails the build** when `license` or `source` (or `licenseUrl`) is missing or empty. Do not bypass it.

## Screenshots and art

Hub screenshots and Open Graph images must come from the game itself (captured frames) or from assets we own. Do not scrape third-party store art.

## Privacy

Listed games should not require accounts or collect personal data for basic play. The hub itself uses no cookies, no third-party scripts, and no analytics beacons in this MVP.

## Changes

When adding a game, update `data/games.json`, capture screenshots, re-run `node validate.mjs && node build.mjs`, and keep this policy in the PR description checklist.
