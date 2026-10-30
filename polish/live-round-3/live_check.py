#!/workspace/.venv-pw/bin/python
# Run with: /workspace/.venv-pw/bin/python polish/live-round-3/live_check.py
# Writes ONLY to polish/live-round-3/ (new dir for Round 3).
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = "https://games.gettoolstacklab.com"
OUT = Path(__file__).resolve().parent
ARGS = ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
r = {"marker": False, "console_errors": [], "play": {}, "auto_play": {}, "fonts": None}
GEOM = """()=>{const h=document.querySelector('.site-header,header');const f=document.getElementById('game-frame');
const hb=h?h.getBoundingClientRect():null;const fb=f.getBoundingClientRect();
return {header_bottom:hb?Math.round(hb.bottom):0,header_pos:h?getComputedStyle(h).position:null,frame_top:Math.round(fb.top),frame_h:Math.round(fb.height),vh:innerHeight,
 frame_ratio:+(fb.height/innerHeight).toFixed(2),clipped:hb?fb.top<hb.bottom-1:false}}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH"), args=ARGS)
    for label, vp, touch in [("mobile",{"width":390,"height":844},True),("desktop",{"width":1280,"height":800},False)]:
        ctx = b.new_context(viewport=vp, has_touch=touch, is_mobile=touch)
        pg = ctx.new_page(); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(f"console:{m.type}:{m.text}") if m.type=="error" else None)
        pg.goto(BASE+"/", wait_until="load", timeout=60000)
        if label=="mobile":
            r["marker"] = pg.evaluate("document.documentElement.outerHTML.includes('polish-r3')")
            r["fonts"] = pg.evaluate("async()=>{await document.fonts.ready;const s=new Set();document.querySelectorAll('body *').forEach(e=>s.add(getComputedStyle(e).fontFamily.split(',')[0].trim()));return [...s]}")
        for slug,name in [("spud-fling","spud"),("pips-bloom-isle","pip")]:
            pg.goto(BASE+f"/games/{slug}/", wait_until="load", timeout=60000); time.sleep(0.5)
            t0=time.time(); pg.locator("#bay-play").click()
            src=None
            for _ in range(100):
                src=pg.locator("#game-frame").get_attribute("src")
                if src: break
                time.sleep(0.02)
            dt=round((time.time()-t0)*1000)
            time.sleep(3)
            g=pg.evaluate(GEOM)
            r["play"][f"{label}-{name}"]={"src":src,"click_to_src_ms":dt,**g}
            pg.screenshot(path=str(OUT/f"{label}-{name}-playing.png"))
        r["console_errors"].extend(errs); ctx.close()
    ctx = b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    pg.goto(BASE+"/games/spud-fling/#play", wait_until="domcontentloaded", timeout=60000)
    src=None
    for _ in range(100):
        src=pg.locator("#game-frame").get_attribute("src")
        if src: break
        time.sleep(0.1)
    time.sleep(3)
    r["auto_play"]={"src":src,**pg.evaluate(GEOM)}
    pg.screenshot(path=str(OUT/"mobile-spud-autoplay.png"))
    ctx.close(); b.close()
(OUT/"live_check.json").write_text(json.dumps(r, indent=2)); print(json.dumps(r, indent=2))
