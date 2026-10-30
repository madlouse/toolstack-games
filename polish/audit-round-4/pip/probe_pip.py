#!/workspace/.venv-pw/bin/python
"""Probe Pip's title menu at phone iframe sizes: does Play intersect touch buttons? Writes only to this dir."""
import json, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "https://bloom-isle.gettoolstacklab.com/?internal=1"
tag = sys.argv[2] if len(sys.argv) > 2 else "live"
JS = """() => { const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  return {x:b.left,y:b.top,w:b.width,h:b.height,vis: b.width>0 && cs.display!=='none' && cs.visibility!=='hidden'}; };
  const P = r('play'), out = {play:P, stick:r('stick'), jump:r('bJump'), dive:r('bDive'), hint:r('hint'), title:r('title')};
  const hit = (a,b) => a && b && a.vis && b.vis && a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
  out.overlap = ['stick','jump','dive','hint'].filter(k => hit(P, out[k]));
  out.hintText = document.getElementById('hint')?.innerText; out.hintVisible = out.hint && out.hint.vis; return out; }"""
res = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    for w, h in [(364, 560), (364, 640), (364, 700), (364, 760), (390, 844)]:
        c = b.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True)
        p = c.new_page(); p.goto(URL, wait_until="networkidle", timeout=60000); p.wait_for_timeout(2500)
        r = p.evaluate(JS); res[f"{w}x{h}"] = r
        p.screenshot(path=f"{tag}-{w}x{h}.png"); c.close()
    b.close()
for k, v in res.items():
    print(k, "overlap:", v["overlap"], "hintVisible:", v["hintVisible"], "play:", v["play"] and (round(v["play"]["y"]), round(v["play"]["h"])))
json.dump(res, open(f"{tag}-probe.json", "w"), indent=1)
