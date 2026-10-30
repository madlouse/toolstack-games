// Regenerates test/fixtures/*.json (except vercel.missing-bloom.json). Run from the hub root: node test/make-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
const D = "test/fixtures/";
const real = JSON.parse(readFileSync("data/games.json", "utf8"));
const spud = real[0];
const base = {
  slug: "example-classic",
  title: "Example Classic",
  pitch: "FIXTURE ONLY — a fake MIT-licensed third-party classic used to test validate.mjs and build.mjs.",
  description: "Fixture entry. Not a real game and never shipped: test/fixtures is not read by the production build.",
  howToPlay: "Fixture entry. Use the arrow keys to slide tiles.",
  controls: "Arrow keys or swipe.",
  controlsKeyboard: "Arrow keys to slide tiles.",
  controlsTouch: "Swipe to slide tiles.",
  tips: ["Fixture tip."],
  faq: [{ q: "Is this real?", a: "No. It is a test fixture." }],
  tags: ["puzzle", "2D", "classic"],
  url: "https://classics-example.pages.dev/",
  embed: true,
  embedQuery: "internal=1",
  thumbnail: spud.thumbnail,
  screenshots: spud.screenshots,
  license: "MIT",
  licenseUrl: "https://github.com/example/example-classic/blob/0123abc/LICENSE",
  licenseEvidence: {
    url: "https://github.com/example/example-classic/blob/0123abc/LICENSE",
    quote: "Permission is hereby granted, free of charge, to any person obtaining a copy of this software",
    checked: "2026-10-30"
  },
  copyrightNotice: "Copyright (c) 2014 Jane Example",
  source: "https://github.com/example/example-classic",
  sourceCommit: "0123abc",
  author: "Jane Example",
  authorUrl: "https://example.org/jane",
  modifications: "Removed the analytics snippet and the outbound app-store links; no gameplay changes.",
  shelf: "classics",
  added: "2026-10-30",
  updated: "2026-10-30",
  status: "live",
  seoTitle: "Example Classic: Fixture Puzzle | Toolstack Lab",
  seoDescription: "Fixture only. Example Classic is a fake MIT-licensed sliding puzzle used to test the hub build; it is never shipped to the live site at all.",
  definition: "Example Classic is a fixture entry by Jane Example, MIT licence.",
  genreLabel: "Sliding puzzle",
  cover: spud.cover
};
const w = (name, patch, del = []) => {
  const g = { ...structuredClone(base), ...patch };
  for (const k of del) delete g[k];
  writeFileSync(D + name + ".json", JSON.stringify([g], null, 2) + "\n");
};
w("valid-third-party", {});
w("embedquery-missing", {}, ["embedQuery"]);
w("embedquery-bad", { embedQuery: "utm_source=hub" });
w("embedquery-srchub-third-party", { embedQuery: "src=hub" });
w("gpl", { license: "GPL-3.0-only" });
w("agpl", { license: "AGPL-3.0" });
w("lgpl", { license: "LGPL-2.1-or-later" });
w("cc-by-nc", { license: "CC-BY-NC-4.0" });
w("cc-by-sa", { license: "CC-BY-SA-3.0" });
w("unknown-license", { license: "unknown" });
w("unlisted-license", { license: "WTFPL" });
w("licenseurl-http", { licenseUrl: "http://github.com/example/example-classic/blob/0123abc/LICENSE" });
w("licenseurl-na", { licenseUrl: "n/a (self-made)" });
w("licenseurl-bad-syntax", { licenseUrl: "https//github.com/example/LICENSE" });
w("missing-evidence", {}, ["licenseEvidence"]);
w("evidence-own-site", { licenseUrl: "https://games.gettoolstacklab.com/content-policy/#example-classic" });
w("missing-copyright-notice", {}, ["copyrightNotice"]);
w("source-not-url", { source: "found it on a forum" });
w("missing-frame", { url: "https://not-in-frame-src.example.net/" });
w("third-party-same-origin", { url: "/play/example-classic/" });
w("forbidden-field", { aggregateRating: { ratingValue: 5, ratingCount: 10 } });
w("unknown-field", { licence: "MIT" });
const v = JSON.parse(readFileSync("vercel.json", "utf8"));
for (const h of v.headers) for (const x of h.headers) if (x.key === "Content-Security-Policy")
  x.value = x.value.replace("frame-src ", "frame-src https://classics-example.pages.dev ");
writeFileSync(D + "vercel.fixture.json", JSON.stringify(v, null, 2) + "\n");
// H-09: the real vercel.json minus the classics origin — the real data must then fail validation.
const m = JSON.parse(readFileSync("vercel.json", "utf8"));
for (const h of m.headers) for (const x of h.headers) if (x.key === "Content-Security-Policy")
  x.value = x.value.replace(" https://tsl-classics.pages.dev", "");
writeFileSync(D + "vercel.missing-classics.json", JSON.stringify(m, null, 2) + "\n");
