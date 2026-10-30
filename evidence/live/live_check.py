from playwright.sync_api import sync_playwright
import json
B="https://games.gettoolstacklab.com"
out={}
args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
with sync_playwright() as p:
    b=p.chromium.launch(args=args)
    for name,vp in [("mobile",{"width":390,"height":844}),("desktop",{"width":1280,"height":800})]:
        ctx=b.new_context(viewport=vp,device_scale_factor=2 if name=="mobile" else 1,is_mobile=(name=="mobile"),has_touch=(name=="mobile"))
        pg=ctx.new_page(); errs=[]
        pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror",lambda e:errs.append(str(e)))
        for path,tag in [("/","home"),("/games/spud-fling/","spud"),("/games/pips-bloom-isle/","pip")]:
            pg.goto(B+path,wait_until="load"); pg.wait_for_timeout(500)
            pg.screenshot(path=f"evidence/live/{name}-{tag}.png")
            if path!="/":
                btn=pg.locator("button:has-text('Play'), button:has-text('玩'), [data-play]").first
                btn.click(); pg.wait_for_timeout(6000)
                fr=pg.locator("iframe").first
                out[f"{name}-{tag}-iframe"]={"present":fr.count()>0,"src":fr.get_attribute("src")}
                pg.screenshot(path=f"evidence/live/{name}-{tag}-playing.png")
        out[f"{name}-console-errors"]=errs[:5]
        ctx.close()
    b.close()
json.dump(out,open("evidence/live/live_check.json","w"),indent=1); print(json.dumps(out,indent=1))
