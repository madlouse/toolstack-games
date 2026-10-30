"""R5 probe: on live Pip detail, after Play, measure hub main-thread liveness (rAF/timer ticks) and iframe load time,
to separate 'hub bug' from 'same-site game iframe saturating the shared renderer under SwiftShader'.
Usage: CHROME_PATH=... python pip_probe.py <base> <out_dir>"""
import json, os, sys, time
from playwright.sync_api import sync_playwright
base, out = sys.argv[1].rstrip("/"), sys.argv[2]
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
res = {}
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH"), args=ARGS)
    for slug in ("pips-bloom-isle", "spud-fling"):
        ctx = br.new_context(viewport={"width": 1280, "height": 800}); pg = ctx.new_page()
        pg.goto(f"{base}/games/{slug}/", wait_until="load"); pg.wait_for_timeout(300)
        pg.evaluate("""() => { window.__p={ticks:[], load:null, t0:null, st:[]}; const f=document.getElementById('game-frame'); const s=document.getElementById('bay-status');
          f.addEventListener('load',()=>window.__p.load=performance.now()-window.__p.t0);
          new MutationObserver(()=>window.__p.st.push([Math.round(performance.now()-window.__p.t0), s.textContent])).observe(s,{childList:true,subtree:true,characterData:true});
          setInterval(()=>{ if(window.__p.t0!=null) window.__p.ticks.push(Math.round(performance.now()-window.__p.t0)); },100); }""")
        pg.evaluate("window.__p.t0=performance.now()"); pg.click("#bay-play")
        t = time.time(); pg.wait_for_timeout(30000)
        r = pg.evaluate("window.__p"); ticks = r["ticks"]
        gaps = [b - a for a, b in zip(ticks, ticks[1:])]
        res[slug] = {"iframe_load_ms": r["load"], "status": r["st"], "timer_ticks_in_30s": len(ticks), "max_gap_ms": max(gaps) if gaps else None,
                     "first_tick_ms": ticks[0] if ticks else None, "wall_s": round(time.time() - t, 1)}
        pg.screenshot(path=f"{out}/{slug}-30s.png"); ctx.close()
    br.close()
json.dump(res, open(f"{out}/pip_probe.json", "w"), indent=1); print(json.dumps(res, indent=1))
