#!/usr/bin/env python3
"""Round-1 local audit: screenshots, keyboard, reduced-motion, play iframe."""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"
OUT = Path("/workspace/exp28-games/game-hub/polish/audit-round-1")
OUT.mkdir(parents=True, exist_ok=True)

CHROME_ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-sandbox",
]

PAGES = [
    ("home", "/"),
    ("spud", "/games/spud-fling/"),
    ("pip", "/games/pips-bloom-isle/"),
    ("popular", "/popular/"),
    ("about", "/about/"),
    ("404", "/404.html"),
]
WIDTHS = [320, 768, 1280, 1920]

report = {"screenshots": [], "keyboard": {}, "reduced_motion": {}, "play": {}, "console": {}, "errors": []}

def shot(page, name):
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    report["screenshots"].append(str(path))
    return path

with sync_playwright() as p:
    browser = p.chromium.launch(args=CHROME_ARGS)
    # Multi-width screenshots
    for w in WIDTHS:
        ctx = browser.new_context(viewport={"width": w, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        cons = []
        page.on("console", lambda m: cons.append({"type": m.type, "text": m.text}))
        page.on("pageerror", lambda e: report["errors"].append(str(e)))
        for key, path in PAGES:
            page.goto(BASE + path, wait_until="networkidle", timeout=60000)
            time.sleep(0.3)
            shot(page, f"{key}-{w}")
        report["console"][f"width-{w}"] = [c for c in cons if c["type"] in ("error", "warning")]
        ctx.close()

    # Keyboard-only: Tab to a card Play, Enter
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle")
    # Focus search with /
    page.keyboard.press("/")
    focused = page.evaluate("document.activeElement && document.activeElement.id")
    report["keyboard"]["slash_focus_search"] = focused == "game-search"
    page.keyboard.press("Escape")
    page.evaluate("document.activeElement && document.activeElement.blur()")
    # Tab until we hit a Play btn on a card
    found_play = False
    for _ in range(40):
        page.keyboard.press("Tab")
        info = page.evaluate("""() => {
          const el = document.activeElement;
          if (!el) return null;
          return {tag: el.tagName, text: (el.textContent||'').trim().slice(0,40), href: el.getAttribute('href')||'', cls: el.className||''};
        }""")
        if info and info.get("tag") == "A" and "Play" in (info.get("text") or "") and "/games/" in (info.get("href") or ""):
            found_play = True
            page.keyboard.press("Enter")
            page.wait_for_load_state("networkidle")
            report["keyboard"]["enter_opened"] = "/games/" in page.url
            report["keyboard"]["url_after_enter"] = page.url
            break
    report["keyboard"]["tab_found_play"] = found_play
    ctx.close()

    # Reduced motion: hover should not show preview-layer opacity 1 meaningfully — we check computed
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 800},
        reduced_motion="reduce",
        color_scheme="dark",
    )
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="networkidle")
    card = page.locator(".card").first
    card.hover()
    opacity = page.evaluate("""() => {
      const layer = document.querySelector('.card .preview-layer');
      if (!layer) return null;
      return getComputedStyle(layer).opacity;
    }""")
    report["reduced_motion"]["preview_opacity_on_hover"] = opacity
    # count-to should be static final
    page.goto(BASE + "/popular/", wait_until="networkidle")
    time.sleep(0.6)
    report["reduced_motion"]["popular_scores"] = page.locator("[data-count-to]").all_inner_texts()
    ctx.close()

    # Play iframe on both games
    for slug, name in [("spud-fling", "spud"), ("pips-bloom-isle", "pip")]:
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.goto(BASE + f"/games/{slug}/", wait_until="networkidle")
        page.locator("#play-embed").click()
        page.wait_for_selector("#game-frame:not([hidden])", timeout=15000)
        # wait briefly for src
        time.sleep(1.5)
        src = page.locator("#game-frame").get_attribute("src")
        report["play"][name] = {"iframe_src": src, "loaded": bool(src)}
        shot(page, f"{name}-playing-1280")
        ctx.close()

    # Orientation change on game page (resize)
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    page.goto(BASE + "/games/spud-fling/", wait_until="networkidle")
    before = page.evaluate("""() => {
      const el = document.querySelector('.play-frame-wrap');
      const r = el.getBoundingClientRect();
      return {w: r.width, h: r.height, ar: r.width/r.height};
    }""")
    page.set_viewport_size({"width": 844, "height": 390})
    time.sleep(0.4)
    after = page.evaluate("""() => {
      const el = document.querySelector('.play-frame-wrap');
      const r = el.getBoundingClientRect();
      return {w: r.width, h: r.height, ar: r.width/r.height};
    }""")
    report["orientation"] = {"before": before, "after": after, "ar_delta": abs(before["ar"] - after["ar"])}
    shot(page, "spud-landscape-844x390")
    ctx.close()

    browser.close()

(OUT / "audit.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
