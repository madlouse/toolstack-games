#!/usr/bin/env python3
import json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://games.gettoolstacklab.com"
OUT = Path("/workspace/exp28-games/game-hub/polish/live-round-2")
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
r = {"marker": False, "console_errors": [], "pages": {}, "play": {}, "auto_play": {}, "one_primary": {}, "font": {}}

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for label, vp in [("mobile", {"width":390,"height":844}), ("desktop", {"width":1280,"height":800})]:
        ctx = b.new_context(viewport=vp)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(f"console:{m.type}:{m.text}") if m.type=="error" else None)
        for key, path in [("home","/"),("spud","/games/spud-fling/"),("popular","/popular/")]:
            pg.goto(BASE+path, wait_until="networkidle", timeout=90000)
            time.sleep(0.4)
            shot = OUT/f"{label}-{key}.png"
            pg.screenshot(path=str(shot), full_page=True)
            r["pages"][f"{label}-{key}"] = {"url": pg.url, "shot": str(shot), "title": pg.title()}
            if key=="home" and label=="mobile":
                r["marker"] = pg.evaluate("!!document.documentElement.innerHTML.includes('polish-r2')")
                r["font"] = pg.evaluate("""async()=>{await document.fonts.ready;return{check:document.fonts.check('700 24px \"TSL Display\"'),h1:getComputedStyle(document.querySelector('h1')).fontFamily}}""")
                r["nav"] = pg.evaluate("[...document.querySelectorAll('.nav a')].map(a=>a.textContent.trim())")
            if key=="spud" and label=="desktop":
                r["one_primary"] = pg.evaluate("""()=>[...document.querySelectorAll('button.btn, a.btn')].filter(el=>{const c=el.className||'';return !/btn-secondary|btn-ghost|btn-link/.test(c)&&el.offsetParent!==null}).map(el=>({id:el.id,text:el.textContent.trim().slice(0,30),class:el.className}))""")
        for slug,name in [("spud-fling","spud"),("pips-bloom-isle","pip")]:
            pg.goto(BASE+f"/games/{slug}/", wait_until="networkidle", timeout=90000)
            pg.locator("#play-embed").click()
            pg.wait_for_selector("#game-frame:not([hidden])", timeout=20000)
            time.sleep(2.5)
            src = pg.locator("#game-frame").get_attribute("src")
            r["play"][f"{label}-{name}"] = {"src": src, "ok": bool(src)}
            pg.screenshot(path=str(OUT/f"{label}-{name}-playing.png"), full_page=True)
        r["console_errors"].extend(errs)
        ctx.close()

    # auto #play
    ctx = b.new_context(viewport={"width":390,"height":844})
    pg = ctx.new_page()
    pg.goto(BASE+"/games/spud-fling/#play", wait_until="domcontentloaded", timeout=90000)
    for _ in range(50):
        src = pg.locator("#game-frame").get_attribute("src")
        if src: break
        time.sleep(0.1)
    time.sleep(2)
    r["auto_play"] = {"src": src, "btn": pg.evaluate("document.getElementById('play-embed')&&document.getElementById('play-embed').textContent")}
    pg.screenshot(path=str(OUT/"mobile-spud-autoplay.png"))
    ctx.close()
    b.close()

(OUT/"live_check.json").write_text(json.dumps(r, indent=2))
print(json.dumps(r, indent=2))
