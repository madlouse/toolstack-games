#!/usr/bin/env python3
import json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "https://games.gettoolstacklab.com"
OUT = Path("/workspace/exp28-games/game-hub/polish/live-round-1")
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]

report = {"console_errors": [], "pages": {}, "play": {}}

def grab(page, name):
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return str(path)

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for label, vp in [("mobile", {"width":390,"height":844}), ("desktop", {"width":1280,"height":800})]:
        ctx = browser.new_context(viewport=vp)
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(f"console:{m.type}:{m.text}") if m.type == "error" else None)
        for key, path in [("home","/"),("spud","/games/spud-fling/"),("pip","/games/pips-bloom-isle/"),("popular","/popular/")]:
            page.goto(BASE + path, wait_until="networkidle", timeout=90000)
            time.sleep(0.4)
            shot = grab(page, f"{label}-{key}")
            report["pages"][f"{label}-{key}"] = {"url": page.url, "shot": shot, "title": page.title()}
        # Play both games on this viewport
        for slug, name in [("spud-fling","spud"),("pips-bloom-isle","pip")]:
            page.goto(BASE + f"/games/{slug}/", wait_until="networkidle", timeout=90000)
            page.locator("#play-embed").click()
            page.wait_for_selector("#game-frame:not([hidden])", timeout=20000)
            time.sleep(2.5)
            src = page.locator("#game-frame").get_attribute("src")
            report["play"][f"{label}-{name}"] = {"src": src, "ok": bool(src)}
            grab(page, f"{label}-{name}-playing")
        report["console_errors"].extend(errs)
        ctx.close()
    browser.close()

(OUT / "live_check.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
