#!/workspace/.venv-pw/bin/python
"""Round-4 reproducing checks + light/dark screenshots.
Usage: /workspace/.venv-pw/bin/python r4_check.py <base-url> <out-dir>
Writes ONLY into <out-dir> (must be polish/audit-round-4/... or polish/live-round-4/...).
Checks (names used in ROUND-4.md):
  R4-policy-clean   /content-policy/ shows no literal Markdown markers and no dev/tooling words
  R4-about-fill     /about/ at 1280+1920: content fills >=85% of the container or is two-column
  R4-h1-2lines-390  every page's H1 wraps to <=2 lines at 390px
  R4-touch-44       at 390 (touch, coarse pointer) every visible link/button is >=44px tall and >=24px wide
  R4-left-edge      at 1280 every page's H1 starts at the same left edge as the header brand (+-2px)
  R4-one-play-style detail page: header Play and bay Play share background colour + font family
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip("/")
out = os.path.abspath(sys.argv[2])
assert re.search(r"polish/(audit|live)-round-4(/|$)", out), "refusing to write outside a round-4 dir"
os.makedirs(out, exist_ok=True)
PAGES = {"home": "/", "spud": "/games/spud-fling/", "pip": "/games/pips-bloom-isle/", "popular": "/popular/",
         "about": "/about/", "content-policy": "/content-policy/", "404": "/this-page-does-not-exist-r4/"}
WIDTHS = [390, 768, 1280, 1920]
DEV_WORDS = ["validate.mjs", "build.mjs", "games.json", "data/", "PR description", "checklist", "licenseUrl",
             "embed: true", "embed: false", "re-run", "node ", "build gate", "bypass"]
results = {"base": base, "checks": {}, "fails": []}

def fail(name, msg):
    results["fails"].append(f"{name}: {msg}")

TOUCH_JS = """() => {
 const r=[]; for (const el of document.querySelectorAll('a[href], button, [role=button], summary')) {
  const cs=getComputedStyle(el); if (cs.visibility==='hidden'||cs.display==='none') continue;
  if (el.closest('[hidden]')||el.closest('.visually-hidden')||el.classList.contains('skip-link')) continue;
  const b=el.getBoundingClientRect(); if (b.width===0||b.height===0) continue;
  r.push({t:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,40), w:Math.round(b.width), h:Math.round(b.height), cls:el.className||''});
 } return r; }"""
H1_JS = """() => { const h=document.querySelector('main h1, h1'); if(!h) return null; const cs=getComputedStyle(h);
 const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2; const b=h.getBoundingClientRect();
 const brand=document.querySelector('.site-header a, header a'); const bb=brand?brand.getBoundingClientRect():null;
 return {text:h.innerText, lines:Math.round(b.height/lh), left:Math.round(b.left), brandLeft: bb?Math.round(bb.left):null}; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for scheme in ["light", "dark"]:
        for w in WIDTHS:
            mobile = w == 390
            ctx = br.new_context(viewport={"width": w, "height": 844 if mobile else (1024 if w == 768 else (800 if w == 1280 else 1080))},
                                 color_scheme=scheme, has_touch=mobile, is_mobile=mobile, device_scale_factor=1)
            pg = ctx.new_page()
            for name, path in PAGES.items():
                pg.goto(base + path, wait_until="load"); pg.wait_for_timeout(250)
                pg.screenshot(path=f"{out}/{name}-{w}-{scheme}-fold.png")
                pg.screenshot(path=f"{out}/{name}-{w}-{scheme}-full.png", full_page=True)
                if scheme != "light":
                    continue
                h1 = pg.evaluate(H1_JS)
                results["checks"].setdefault("h1", {})[f"{name}@{w}"] = h1
                if w == 390 and h1 and h1["lines"] > 2:
                    fail("R4-h1-2lines-390", f"{name}: {h1['lines']} lines '{h1['text']}'")
                if w == 1280 and h1 and h1["brandLeft"] is not None and abs(h1["left"] - h1["brandLeft"]) > 2 and name != "404":
                    fail("R4-left-edge", f"{name}: h1 left {h1['left']} vs brand {h1['brandLeft']}")
                if mobile:
                    t = pg.evaluate(TOUCH_JS)
                    small = [x for x in t if x["h"] < 44 or x["w"] < 24]
                    results["checks"].setdefault("touch", {})[name] = small
                    for x in small:
                        fail("R4-touch-44", f"{name}: '{x['t']}' {x['w']}x{x['h']} .{x['cls']}")
                if name == "content-policy":
                    txt = pg.inner_text("main")
                    md = [l for l in txt.splitlines() if re.match(r"^\s*([-*+] |#{1,6} |\d+\. |>)", l) or "**" in l or "`" in l]
                    dev = [d for d in DEV_WORDS if d.lower() in txt.lower()]
                    results["checks"]["policy"] = {"md_lines": md, "dev_words": dev}
                    if md: fail("R4-policy-clean", f"markdown markers: {md[:3]}")
                    if dev: fail("R4-policy-clean", f"dev words: {dev}")
                if name in ("about", "content-policy") and w in (1280, 1920):
                    m = pg.evaluate("""() => { const wrap=document.querySelector('main.wrap'); const wb=wrap.getBoundingClientRect();
                      const cols=document.querySelector('.page-cols'); const n=cols?getComputedStyle(cols).gridTemplateColumns.split(' ').length:1;
                      let L=1e9,R=0; for (const el of wrap.querySelectorAll('p,li,h2,h3,aside,dl')) { const b=el.getBoundingClientRect(); if(!b.width) continue; L=Math.min(L,b.left); R=Math.max(R,b.right);}
                      return {wrapW:Math.round(wb.width), fill:+((R-L)/wb.width).toFixed(3), columns:n}; }""")
                    results["checks"].setdefault("fill", {})[f"{name}@{w}"] = m
                    if not (m["fill"] >= 0.85 or m["columns"] >= 2):
                        fail("R4-about-fill", f"{name}@{w}: fill {m['fill']} cols {m['columns']}")
                if name == "spud" and w == 1280:
                    s = pg.evaluate("""() => { const a=document.getElementById('play-embed'), b=document.getElementById('bay-play');
                      const f=e=>{const c=getComputedStyle(e);return {bg:c.backgroundColor,color:c.color,font:c.fontFamily.split(',')[0]}}; return {header:f(a), bay:f(b)}; }""")
                    results["checks"]["play_style"] = s
                    if s["header"] != s["bay"]:
                        fail("R4-one-play-style", json.dumps(s))
            ctx.close()
    br.close()
results["pass"] = not results["fails"]
json.dump(results, open(f"{out}/r4_check.json", "w"), indent=1)
print("PASS" if results["pass"] else "FAIL", len(results["fails"]))
for f in results["fails"]: print(" -", f)
