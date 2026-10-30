#!/usr/bin/env python3
"""Round-3 audit: header-vs-iframe after #play, font families, dock motion, reduced motion, shelf, touch targets."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else str(Path(__file__).parent))
PREFIX = sys.argv[3] if len(sys.argv) > 3 else ""
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
r = {"base": BASE, "console": [], "play": {}, "fonts": {}, "overflow": {}, "reduced": {}, "shelf": {}, "touch": {}, "dock": {}, "shots": []}

MEASURE = """()=>{const h=document.querySelector('.site-header').getBoundingClientRect();
const hs=getComputedStyle(document.querySelector('.site-header')).position;
const p=document.querySelector('.play-panel').getBoundingClientRect();
const f=document.getElementById('game-frame');const fr=f.getBoundingClientRect();
const hb=Math.max(0,h.bottom);
return {header_pos:hs,header_bottom:hb,header_h:h.height,panel_top:p.top,iframe_top:fr.top,iframe_h:fr.height,
iframe_src:f.getAttribute('src'),scrollY:scrollY,ok_panel:p.top>=hb-0.5,ok_iframe:fr.top>=hb-0.5,
iframe_fully_visible:fr.top>=hb-0.5&&fr.bottom<=innerHeight+0.5}}"""
FONTS = """()=>{const s=new Set();for(const el of document.querySelectorAll('body *')){if(!el.textContent.trim())continue;s.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/"/g,''))}return [...s]}"""

def shot(pg, name, **kw):
    f = OUT / f"{PREFIX}{name}.png"; pg.screenshot(path=str(f), **kw); r["shots"].append(str(f))

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    def ctx_for(w, h, **kw):
        c = b.new_context(viewport={"width": w, "height": h}, **kw)
        pg = c.new_page()
        pg.on("console", lambda m: r["console"].append(f"{w}:{m.type}:{m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: r["console"].append(f"{w}:pageerror:{e}"))
        return c, pg
    for w, h in [(320, 640), (390, 844), (1280, 800)]:
        mob = w < 500
        c, pg = ctx_for(w, h, has_touch=mob, is_mobile=mob, color_scheme="dark")
        for k, path in [("home", "/"), ("spud", "/games/spud-fling/"), ("popular", "/popular/")]:
            pg.goto(BASE + path, wait_until="networkidle", timeout=90000); time.sleep(0.6)
            shot(pg, f"{k}-{w}", full_page=True)
            r["overflow"][f"{k}-{w}"] = pg.evaluate("document.documentElement.scrollWidth<=innerWidth")
            r["fonts"][f"{k}-{w}"] = pg.evaluate(FONTS)
            if k == "home":
                r["shelf"][str(w)] = pg.evaluate("""()=>[...document.querySelectorAll('#games-grid .card')].map(c=>{const b=c.getBoundingClientRect();return {w:Math.round(b.width),x:Math.round(b.x)}})""")
                r["touch"][str(w)] = pg.evaluate("""()=>[...document.querySelectorAll('.site-footer a,.nav a,.btn')].map(a=>Math.round(a.getBoundingClientRect().height)).reduce((m,x)=>Math.min(m,x),999)""")
            if k == "spud":
                shot(pg, f"spud-idle-{w}")
        # autoplay via #play
        pg.goto(BASE + "/games/spud-fling/#play", wait_until="load", timeout=90000)
        time.sleep(0.15)
        if w == 1280:
            shot(pg, "spud-docking-1280")  # mid dock beat
        time.sleep(4)
        m = pg.evaluate(MEASURE); r["play"][str(w)] = m
        shot(pg, f"spud-autoplay-{w}")
        top = max(0, m["header_bottom"] - 8)
        shot(pg, f"spud-autoplay-{w}-iframe-top", clip={"x": 0, "y": top, "width": w, "height": min(220, h - top)})
        # click path (no hash) from home
        pg.goto(BASE + "/", wait_until="networkidle")
        pg.click(".featured a.btn[href*='#play']"); pg.wait_for_load_state("load"); time.sleep(3)
        r["play"][f"{w}-from-home"] = pg.evaluate(MEASURE)
        c.close()
    # reduced motion
    c, pg = ctx_for(390, 844, reduced_motion="reduce", has_touch=True, is_mobile=True)
    pg.goto(BASE + "/games/spud-fling/#play", wait_until="load"); time.sleep(0.1)
    r["reduced"]["running_anims_at_100ms"] = pg.evaluate("document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName||a.constructor.name)")
    time.sleep(3)
    r["reduced"]["measure"] = pg.evaluate(MEASURE)
    shot(pg, "spud-390-reduced-autoplay")
    c.close()
    # dock motion props: only transform/opacity animated
    c, pg = ctx_for(1280, 800)
    pg.goto(BASE + "/games/spud-fling/", wait_until="networkidle")
    t0 = time.time(); pg.click("#play-embed")
    r["dock"]["src_set_ms_after_click"] = round((time.time() - t0) * 1000)
    r["dock"]["src"] = pg.evaluate("document.getElementById('game-frame').getAttribute('src')")
    r["dock"]["anims"] = pg.evaluate("""()=>document.getAnimations().map(a=>({name:a.animationName,props:[...new Set(a.effect.getKeyframes().flatMap(k=>Object.keys(k).filter(x=>!['offset','easing','composite','computedOffset'].includes(x))))]}))""")
    time.sleep(0.12); shot(pg, "spud-dock-midbeat-1280")
    c.close()
    b.close()
json.dump(r, open(OUT / f"{PREFIX}audit.json", "w"), indent=1)
bad = [k for k, v in r["play"].items() if not (v["ok_iframe"] and v["iframe_src"])]
print(json.dumps({"play": r["play"], "fonts": {k: v for k, v in r["fonts"].items()}, "console": r["console"], "reduced": r["reduced"], "dock": r["dock"], "shelf": r["shelf"], "touch": r["touch"], "overflow_ok": all(r["overflow"].values()), "play_fail": bad}, indent=1))
