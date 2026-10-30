#!/usr/bin/env python3
"""R3 P0 sweep: every page type at 390/768/1280/1920 + geometry checks (bars, holes, card alignment)."""
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1].rstrip('/'); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
PAGES = {"home": "/", "spud": "/games/spud-fling/", "pip": "/games/pips-bloom-isle/", "popular": "/popular/", "about": "/about/", "policy": "/content-policy/", "404": "/no-such-page/"}
WIDTHS = [390, 768, 1280, 1920]
CHECK = r"""() => {
  const r = {};
  const doc = document.documentElement;
  r.overflow_x = doc.scrollWidth > doc.clientWidth + 1;
  r.fonts = [...new Set([...document.querySelectorAll('body *')].map(e => getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/"/g,'')))];
  // black bars: every visible content image must fill its box with object-fit cover OR match box ratio
  r.images = [...document.querySelectorAll('main img:not(.lqip)')].filter(i => i.offsetWidth > 40).map(i => {
    const b = i.getBoundingClientRect(), cs = getComputedStyle(i), nat = i.naturalWidth / i.naturalHeight, box = b.width / b.height;
    const p = i.closest('.card-thumb,.detail-media,.shot-slot,figure')?.getBoundingClientRect();
    return {src: i.currentSrc.split('/').slice(-2).join('/'), fit: cs.objectFit, nat: +nat.toFixed(3), box: +box.toFixed(3),
      fills_parent: p ? (Math.abs(p.width - b.width) < 3 && Math.abs(p.height - b.height) < 3) : null,
      bars: cs.objectFit !== 'cover' && Math.abs(nat - box) > 0.02};
  });
  const cards = [...document.querySelectorAll('.grid > .card:not([hidden])')];
  r.cards = cards.map(c => { const b = c.getBoundingClientRect(); const a = c.querySelector('.card-actions')?.getBoundingClientRect();
    return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), actions_bottom_gap: a ? Math.round(b.bottom - a.bottom) : null}; });
  const g = document.querySelector('.grid'); if (g) { const gb = g.getBoundingClientRect();
    const rows = {}; r.cards.forEach(c => (rows[c.y] = rows[c.y] || []).push(c));
    r.grid_holes = Object.values(rows).some(row => Math.abs(row.reduce((s, c) => s + c.w, 0) + (row.length - 1) * 16 - gb.width) > 24);
    r.grid_w = Math.round(gb.width); r.grid_x = Math.round(gb.x); }
  const m = document.querySelector('main .wrap, main')?.getBoundingClientRect(); r.main_x = m ? Math.round(m.x) : null; r.main_w = m ? Math.round(m.width) : null;
  r.hint_visible = [...document.querySelectorAll('.hint-fine,.pointer-fine')].some(e => e.offsetParent !== null);
  r.similar = [...document.querySelectorAll('.similar-carts > *')].map(c => Math.round(c.getBoundingClientRect().width)); r.similar_w = Math.round(document.querySelector('.similar-carts')?.getBoundingClientRect().width || 0);
  r.small_targets = [...document.querySelectorAll('header a,footer a,button,input,.section-link,.btn')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 44; }).map(e => (e.textContent||e.name||'').trim().slice(0,30));
  return r;
}"""
res = {}
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--no-sandbox"])
    for theme in ("light", "dark"):
      for w in WIDTHS:
        mob = w < 500; touch = w <= 768
        ctx = br.new_context(viewport={"width": w, "height": 844 if mob else (1024 if w == 768 else (800 if w == 1280 else 1080))}, is_mobile=mob, has_touch=touch, device_scale_factor=1, color_scheme=theme)
        for name, path in PAGES.items():
            pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(BASE + (path if not BASE.startswith("http://localhost") or path in ("/", "/no-such-page/") or path.endswith("/") else path), wait_until="load", timeout=30000)
            if name == "404" and BASE.startswith("http://localhost"): pg.goto(BASE + "/404.html", wait_until="load", timeout=30000)
            pg.evaluate("async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); }")
            pg.wait_for_timeout(300)
            pg.evaluate("() => Promise.race([Promise.all([...document.images].map(i => i.decode().catch(() => 0))), new Promise(r => setTimeout(r, 4000))])"); pg.wait_for_timeout(900)
            r = pg.evaluate(CHECK); r["console_errors"] = errs
            f = f"{OUT}/{name}-{w}-{theme}-full.png"; pg.screenshot(path=f, full_page=True); r["shot"] = f
            pg.screenshot(path=f"{OUT}/{name}-{w}-{theme}-first.png"); r["first"] = f"{OUT}/{name}-{w}-{theme}-first.png"
            res[f"{name}-{w}-{theme}"] = r; pg.close(); print("shot", name, w, theme, flush=True)
        ctx.close()
    br.close()
json.dump(res, open(f"{OUT}/pages.json", "w"), indent=1)
for k, r in res.items():
    bars = [i["src"] for i in r["images"] if i["bars"] or i["fills_parent"] is False]
    print(k, "ovf" if r["overflow_x"] else "", "BARS:" + ",".join(bars) if bars else "", "HOLES" if r.get("grid_holes") else "",
          "cards=" + str([(c["w"], c["h"]) for c in r["cards"]]) if r["cards"] else "", "sim=%s/%s" % (r["similar"], r["similar_w"]) if r["similar"] else "", "HINT" if r["hint_visible"] and "390" in k else "", "fonts=" + "/".join(r["fonts"]), "err=%d" % len(r["console_errors"]), "small=" + str(r["small_targets"][:4]) if r["small_targets"] else "")
