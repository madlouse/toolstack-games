#!/workspace/.venv-pw/bin/python
"""Live: console/CSP errors on each page + instant-play (iframe src set on click). Writes only polish/live-round-4/live_play_csp.json"""
import json, time
from playwright.sync_api import sync_playwright
B="https://games.gettoolstacklab.com"; res={}
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    errs=[]; pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    for path in ["/","/about/","/content-policy/","/popular/","/games/spud-fling/","/games/pips-bloom-isle/"]:
        errs.clear(); pg.goto(B+path, wait_until="load"); pg.wait_for_timeout(300)
        r={"console_errors":list(errs)}
        if path.startswith("/games/"):
            t=time.time(); pg.click("#bay-play"); src=pg.get_attribute("#game-frame","src"); r["iframe_src_after_click"]=src; r["ms_to_src"]=round((time.time()-t)*1000)
            pg.wait_for_timeout(1500); r["console_errors_after_play"]=[e for e in errs if "Content Security Policy" in e]
            pg.screenshot(path=f"polish/live-round-4/{path.strip('/').split('/')[-1]}-390-after-play.png")
        res[path]=r
    br.close()
json.dump(res, open("polish/live-round-4/live_play_csp.json","w"), indent=1); print(json.dumps(res, indent=1))
