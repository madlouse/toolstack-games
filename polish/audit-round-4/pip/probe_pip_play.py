#!/workspace/.venv-pw/bin/python
"""After tapping Play in Pip at 364x560 touch: touch controls must be visible again (menu class removed)."""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; tag = sys.argv[2]
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    c = b.new_context(viewport={"width": 364, "height": 560}, is_mobile=True, has_touch=True)
    p = c.new_page(); p.goto(URL, wait_until="networkidle"); p.wait_for_timeout(2000)
    p.tap("#play"); p.wait_for_timeout(1500)
    r = p.evaluate("() => ({menu: document.body.classList.contains('menu'), touch: getComputedStyle(document.getElementById('touch')).display, hint: getComputedStyle(document.getElementById('hint')).display})")
    p.screenshot(path=f"{tag}-364x560-after-play.png"); print(json.dumps(r)); b.close()
