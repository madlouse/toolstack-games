#!/workspace/.venv-pw/bin/python
"""Live check for Pip touch-menu patch: 390x844 touch (hub iframe + direct host) and 1280 desktop."""
import json, os, sys, time
from playwright.sync_api import sync_playwright
OUT = os.path.dirname(os.path.abspath(__file__))
HUB = "https://games.gettoolstacklab.com/games/pips-bloom-isle/#play"
DIRECT = "https://bloom-isle.gettoolstacklab.com/"
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
CHROME = os.environ.get("CHROME_PATH", "/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome")
PROBE = """() => { const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  const vis = b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; return {x:b.x,y:b.y,w:b.width,h:b.height,vis}; };
  return {menu: document.body.classList.contains('menu'), touchCls: document.body.classList.contains('touch'),
    play: r('play'), stick: r('stick'), jump: r('bJump'), dive: r('bDive'), hint: r('hint'), touch: r('touch'),
    titleDisplay: getComputedStyle(document.getElementById('title')).display,
    state: window.__game ? window.__game.state() : null}; }"""
def overlap(a, b):
    if not a or not b or not a["vis"] or not b["vis"]: return False
    return not (a["x"] + a["w"] <= b["x"] or b["x"] + b["w"] <= a["x"] or a["y"] + a["h"] <= b["y"] or b["y"] + b["h"] <= a["y"])
results = {}; fails = []
def check(name, cond, detail=""):
    results.setdefault("_checks", []).append({"check": name, "pass": bool(cond), "detail": detail})
    if not cond: fails.append(name)
def poll(frame, fn, timeout=90):
    # CSP-safe wait (the hub's script-src 'self' blocks Playwright's wait_for_function eval)
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if frame.evaluate(fn): return
        except Exception: pass
        frame.page.wait_for_timeout(500)
    raise RuntimeError("timeout waiting for " + fn)
def game_frame(page, hub):
    if not hub: return page.main_frame
    page.wait_for_selector("#game-frame[src]", state="attached", timeout=60000)
    poll(page.main_frame, "() => { const f = document.getElementById('game-frame'); return !!(f && !f.hidden); }")
    for _ in range(120):
        for f in page.frames:
            if f.url.startswith("https://bloom-isle.gettoolstacklab.com"): return f
        page.wait_for_timeout(500)  # pumps Playwright events (time.sleep would not)
    raise RuntimeError("game iframe not found")
def run(pw, label, url, hub, touch):
    b = pw.chromium.launch(executable_path=CHROME, args=ARGS)
    ctx = b.new_context(viewport={"width": 390, "height": 844} if touch else {"width": 1280, "height": 800},
                        is_mobile=touch, has_touch=touch, device_scale_factor=2 if touch else 1)
    p = ctx.new_page(); errs = []
    p.on("pageerror", lambda e: errs.append(str(e) + " | " + (e.stack or "")[:600]))
    p.goto(url, wait_until="domcontentloaded", timeout=60000)
    f = game_frame(p, hub)
    poll(f, "() => !!window.__game"); f.wait_for_selector("#play", state="visible", timeout=60000)
    p.wait_for_timeout(2000)
    m = f.evaluate(PROBE); p.screenshot(path=f"{OUT}/{label}-menu.png")
    r = {"url": url, "frame_url": f.url, "menu": m}
    if touch:
        check(f"{label}: body.touch set", m["touchCls"])
        check(f"{label}: body.menu set on title", m["menu"])
        check(f"{label}: menu Play visible", m["play"]["vis"], m["play"])
        for k in ("stick", "jump", "dive"):
            check(f"{label}: menu Play not overlapped by {k}", not overlap(m["play"], m[k]), {"play": m["play"], k: m[k]})
            check(f"{label}: {k} hidden while menu open", not m[k]["vis"], m[k])
        check(f"{label}: keyboard legend hidden on touch (menu)", not m["hint"]["vis"], m["hint"])
        f.tap("#play")
    else:
        check(f"{label}: no touch class on desktop", not m["touchCls"])
        check(f"{label}: keyboard legend visible on desktop (menu)", m["hint"]["vis"], m["hint"])
        check(f"{label}: touch controls hidden on desktop", not m["touch"]["vis"], m["touch"])
        f.click("#play")
    p.wait_for_timeout(2500)
    s0 = f.evaluate(PROBE)
    if not touch:
        f.click("canvas", position={"x": 640, "y": 300}) if f.query_selector("canvas") else None
        p.keyboard.down("KeyW"); p.wait_for_timeout(2500); p.keyboard.up("KeyW")
    else:
        p.wait_for_timeout(1000)
    lv = f.evaluate(PROBE); p.screenshot(path=f"{OUT}/{label}-level.png")
    r["level"] = lv; r["level_start_state"] = s0["state"]; r["pageerrors"] = errs
    check(f"{label}: title closed after Play", lv["titleDisplay"] == "none", lv["titleDisplay"])
    check(f"{label}: body.menu cleared in level", not lv["menu"])
    if touch:
        for k in ("stick", "jump", "dive"):
            check(f"{label}: {k} visible in level", lv[k]["vis"], lv[k])
        check(f"{label}: keyboard legend hidden on touch (level)", not lv["hint"]["vis"], lv["hint"])
    else:
        check(f"{label}: keyboard legend visible in level", lv["hint"]["vis"], lv["hint"])
        a, z = s0["state"]["pos"], lv["state"]["pos"]
        moved = ((a[0]-z[0])**2 + (a[2]-z[2])**2) ** 0.5
        r["moved_m"] = round(moved, 2)
        check(f"{label}: level starts and W moves player", moved > 0.5, round(moved, 2))
    check(f"{label}: no page errors", not errs, errs)
    results[label] = r; b.close()
with sync_playwright() as pw:
    for label, url, hub, touch in [("hub-390-touch", HUB, True, True), ("direct-390-touch", DIRECT, False, True),
                                   ("hub-1280-desktop", HUB, True, False), ("direct-1280-desktop", DIRECT, False, False)]:
        try: run(pw, label, url, hub, touch)
        except Exception as e: check(f"{label}: ran", False, repr(e))
results["fails"] = fails; results["pass"] = not fails
json.dump(results, open(f"{OUT}/live-pip-touch.json", "w"), indent=1, default=str)
for c in results["_checks"]: print(("PASS " if c["pass"] else "FAIL ") + c["check"])
print("ALL PASS" if not fails else f"{len(fails)} FAIL")
