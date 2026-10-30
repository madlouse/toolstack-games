#!/usr/bin/env python3
"""Round-2 audit: shots, font, dock, auto-#play, one primary, reduced-motion, keyboard, play, axe, CLS."""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/workspace/exp28-games/game-hub/polish/audit-round-2")
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
AXE = Path("/workspace/fontwork/axe.min.js")
PAGES = [("home", "/"), ("spud", "/games/spud-fling/"), ("popular", "/popular/")]
r = {"base": BASE, "shots": [], "console": [], "fonts": {}, "third_party": [], "dock": {}, "auto_play": {},
     "one_primary": {}, "reduced": {}, "keyboard": {}, "play": {}, "axe": {}, "cls": {}, "nav": {}}

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    for w, h in [(320, 800), (390, 844), (1280, 800)]:
        for scheme in (["dark"] if w == 320 else ["dark", "light"]):
            ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
            pg = ctx.new_page()
            host = BASE.split("/")[2]
            pg.on("console", lambda m: r["console"].append(f"{m.type}:{m.text}") if m.type in ("error","warning") else None)
            pg.on("pageerror", lambda e: r["console"].append(f"pageerror:{e}"))
            pg.on("request", lambda q: r["third_party"].append(q.url) if host not in q.url and not q.url.startswith("data:") and "tsl-game1" not in q.url and "bloom-isle" not in q.url else None)
            for k, path in PAGES:
                pg.goto(BASE + path, wait_until="networkidle", timeout=90000)
                time.sleep(0.35)
                f = OUT / f"{k}-{w}-{scheme}.png"
                pg.screenshot(path=str(f), full_page=True)
                r["shots"].append(str(f))
                if w == 390 and k == "home" and scheme == "dark":
                    # nav orphan Policy check
                    r["nav"]["links"] = pg.evaluate("""()=>[...document.querySelectorAll('.nav a')].map(a=>({t:a.textContent.trim(),y:a.getBoundingClientRect().y}))""")
                    r["nav"]["policy_in_header"] = pg.evaluate("!!document.querySelector('.site-header a[href*=CONTENT-POLICY]')")
                if w == 1280 and scheme == "dark":
                    r["fonts"][k] = pg.evaluate("""async()=>{await document.fonts.ready;return {
                      check: document.fonts.check('700 24px \"TSL Display\"'),
                      h1: getComputedStyle(document.querySelector('h1')).fontFamily,
                      body: getComputedStyle(document.body).fontFamily,
                      faces: [...document.fonts].filter(f=>f.family.includes('TSL')).map(f=>({family:f.family,status:f.status}))
                    }}""")
                    if AXE.exists():
                        pg.add_script_tag(path=str(AXE))
                        r["axe"][f"{k}-dark"] = pg.evaluate("async()=>{const x=await axe.run(document,{resultTypes:['violations']});return x.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length}))}")
            ctx.close()

    # CLS
    for k, path in PAGES:
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        pg.add_init_script("window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value}}).observe({type:'layout-shift',buffered:true});")
        pg.goto(BASE + path, wait_until="networkidle"); time.sleep(1.2)
        r["cls"][k] = pg.evaluate("window.__cls"); ctx.close()

    # One primary on detail
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    pg = ctx.new_page()
    pg.goto(BASE + "/games/spud-fling/", wait_until="networkidle")
    r["one_primary"] = pg.evaluate("""()=>{
      const prim=[...document.querySelectorAll('button.btn, a.btn')].filter(el=>{
        const c=el.className||'';
        return !/btn-secondary|btn-ghost|btn-link/.test(c) && el.offsetParent!==null;
      }).map(el=>({tag:el.tagName,id:el.id,text:el.textContent.trim().slice(0,40),class:el.className}));
      return {primary_count: prim.length, primaries: prim, has_load_alt: !!document.getElementById('play-embed-alt')};
    }""")
    pg.screenshot(path=str(OUT/"spud-bay-idle-1280.png"))
    # dock motion
    pg.locator("#play-embed").click()
    samples=[]
    for _ in range(5):
        samples.append(pg.evaluate("(()=>{const e=document.getElementById('dock-cart');const s=getComputedStyle(e);return {op:s.opacity,anim:s.animationName}})()"))
        time.sleep(0.05)
    time.sleep(2.5)
    r["dock"]={"samples":samples,"src":pg.locator("#game-frame").get_attribute("src"),"hash":pg.evaluate("location.hash")}
    pg.screenshot(path=str(OUT/"spud-playing-1280.png")); ctx.close()

    # Auto #play from cold load (simulates home card Play)
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page()
    t0=time.time()
    pg.goto(BASE + "/games/spud-fling/#play", wait_until="domcontentloaded", timeout=90000)
    # wait for src
    for _ in range(40):
        src = pg.locator("#game-frame").get_attribute("src")
        if src: break
        time.sleep(0.1)
    r["auto_play"]={"src":src,"ms":int((time.time()-t0)*1000),"btn":pg.evaluate("document.getElementById('play-embed')&&document.getElementById('play-embed').textContent"),"placeholder_hidden":pg.evaluate("document.getElementById('play-placeholder').hidden")}
    time.sleep(2)
    pg.screenshot(path=str(OUT/"spud-390-autoplay.png")); ctx.close()

    # Reduced motion
    ctx = b.new_context(viewport={"width":390,"height":844}, reduced_motion="reduce")
    pg = ctx.new_page()
    pg.goto(BASE+"/", wait_until="networkidle")
    r["reduced"]["card_anim"]=pg.evaluate("getComputedStyle(document.querySelector('#games-grid .card')).animationName")
    pg.screenshot(path=str(OUT/"home-390-reduced.png"), full_page=True)
    pg.goto(BASE+"/games/spud-fling/#play", wait_until="networkidle")
    time.sleep(0.5)
    r["reduced"]["dock"]=pg.evaluate("(()=>{const s=getComputedStyle(document.getElementById('dock-cart'));return {anim:s.animationName,op:s.opacity,src:document.getElementById('game-frame').getAttribute('src')}})()")
    pg.screenshot(path=str(OUT/"spud-390-reduced-playing.png")); ctx.close()

    # Keyboard: / + featured Enter
    ctx = b.new_context(viewport={"width":1280,"height":800})
    pg = ctx.new_page()
    pg.goto(BASE+"/", wait_until="networkidle")
    pg.keyboard.press("/")
    r["keyboard"]["slash"]=pg.evaluate("document.activeElement && document.activeElement.id")
    pg.evaluate("document.querySelector('.featured[data-play-href]').focus()")
    pg.keyboard.press("Enter")
    pg.wait_for_load_state("domcontentloaded")
    time.sleep(0.8)
    r["keyboard"]["featured_enter_url"]=pg.url
    r["keyboard"]["featured_auto_src"]=pg.evaluate("document.getElementById('game-frame')&&document.getElementById('game-frame').getAttribute('src')")
    ctx.close()

    # Play both
    for slug,name in [("spud-fling","spud"),("pips-bloom-isle","pip")]:
        ctx=b.new_context(viewport={"width":390,"height":844})
        pg=ctx.new_page()
        pg.goto(BASE+f"/games/{slug}/", wait_until="networkidle")
        pg.locator("#play-embed").click()
        pg.wait_for_selector("#game-frame:not([hidden])")
        time.sleep(2.5)
        r["play"][name]={"src":pg.locator("#game-frame").get_attribute("src")}
        pg.screenshot(path=str(OUT/f"{name}-390-playing.png")); ctx.close()
    b.close()

r["third_party"]=sorted(set(r["third_party"]))
r["console"]=r["console"][:40]
(OUT/"audit.json").write_text(json.dumps(r, indent=2))
print(json.dumps({k:v for k,v in r.items() if k!='shots'}, indent=2))
