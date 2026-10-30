# Where the polish evidence lives

Screenshots, Lighthouse runs, probe/check JSON, HTML/log reports, baselines and patches produced during the
polish rounds are **not in this repo** (moved out on 2026-10-30 to keep the public repo small).

They live on the Toolstack Lab build box (not published) at:

    /workspace/exp28-games/game-hub-evidence/polish/

That directory mirrors this `polish/` tree exactly (same sub-paths), so a reference in `ROUND-*.md`,
`ITERATION-LOG.md` or `INDEPENDENT-REVIEW-*.md` such as `polish/audit-round-4/shots/…` resolves to
`/workspace/exp28-games/game-hub-evidence/polish/audit-round-4/shots/…`.

What stays here: the round notes (`*.md`) and the check scripts (`*.py`, `*.cjs`, `*.mjs`, `*.sh`).
`.gitignore` keeps new evidence under `polish/` out of git. Older commits still contain the original files
(history was not rewritten).
