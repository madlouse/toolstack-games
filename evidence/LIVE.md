# Live deployment evidence (2026-10-31, Asia/Shanghai)
- Live: https://games.gettoolstacklab.com/  (Vercel Hobby/free project `toolstack-games`, DNS-only CNAME `games` -> cname.vercel-dns.com in Cloudflare)
- Repo: https://github.com/madlouse/toolstack-games (public, MIT), commit 7a84082
- HTTP 200: /, /games/spud-fling/, /games/pips-bloom-isle/, /og.png, /sitemap.xml; unknown path -> 404 page
- CSP + frame-src for the two game origins served by Vercel (see vercel.json)
- Lighthouse on the LIVE URL, mobile form factor, simulated throttling (`live/home-mobile-live.json`): performance 1.0, accessibility 1.0, best-practices 1.0, SEO 1.0; FCP 1.0 s, LCP 1.0 s, CLS 0, TBT 0 ms, TTI 1.0 s
- Playwright on live (`live/live_check.py`, `live/live_check.json`): mobile 390x844 and desktop 1280x800; home + both detail pages screenshots; clicking Play inserts the iframe (Spud Fling -> tsl-game1.pages.dev, Pip -> bloom-isle.gettoolstacklab.com) and the game renders (`live/*-playing.png`); 0 console errors
- Not covered: real-device performance, real-user play counts (plays = 0 unknown), polish loop (UI-POLISH-DIRECTIVE.md) not yet run
