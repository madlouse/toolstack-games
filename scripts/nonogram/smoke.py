import json
import random
import socket
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

DIST = Path(sys.argv[1] if len(sys.argv) > 1 else "dist").resolve()
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "smoke-out").resolve()
SEED = int(sys.argv[3] if len(sys.argv) > 3 else "20261109")
OUT.mkdir(parents=True, exist_ok=True)


def free_port():
    for port in range(41731, 41750):
        sock = socket.socket()
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        finally:
            sock.close()
        return port
    raise RuntimeError("no free port")


def main():
    pages = sorted(DIST.glob("nonogram/*/*/*/index.html"))
    rng = random.Random(SEED)
    chosen = rng.sample(pages, 3)
    port = free_port()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=DIST,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    results = {"seed": SEED, "viewport": [390, 844], "pages": []}
    failed = False
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path="/opt/google/chrome/chrome", headless=True)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            )
            for html in chosen:
                rel = html.relative_to(DIST).as_posix()
                slug = rel.replace("/index.html", "").replace("nonogram/", "").replace("/", "-")
                url = f"http://127.0.0.1:{port}/{rel[:-len('index.html')]}"
                errors = []
                page = context.new_page()
                page.on("console", lambda msg, bucket=errors: bucket.append({"type": msg.type, "text": msg.text}) if msg.type == "error" else None)
                page.on("pageerror", lambda err, bucket=errors: bucket.append({"type": "pageerror", "text": str(err)}))
                page.goto(url, wait_until="load")
                page.locator("#ng-board").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{slug}-load.png"))
                cell = page.locator(".ng-cell").first
                cell.tap()
                on = "is-on" in (cell.get_attribute("class") or "")
                cell.tap()
                off = "is-on" not in (cell.get_attribute("class") or "")
                page.evaluate(
                    """() => {
                      const board = document.getElementById("ng-board");
                      const sol = board.getAttribute("data-solution");
                      const cells = board.querySelectorAll(".ng-cell");
                      cells.forEach((el, i) => {
                        const filled = el.classList.contains("is-on");
                        if (filled !== (sol.charAt(i) === "1")) el.click();
                      });
                    }"""
                )
                page.locator("#ng-win").wait_for(state="visible", timeout=5000)
                won = page.locator("#ng-board").get_attribute("data-state") == "won"
                flag = page.locator("#ng-win").get_attribute("data-win") == "1"
                visible = page.locator("#ng-win").is_visible()
                page.locator("#ng-win").scroll_into_view_if_needed()
                page.screenshot(path=str(OUT / f"{slug}-win.png"))
                row = {
                    "url": url,
                    "file": rel,
                    "toggleOn": on,
                    "toggleOff": off,
                    "won": won,
                    "winFlag": flag,
                    "winVisible": visible,
                    "consoleErrors": errors,
                }
                results["pages"].append(row)
                if not (on and off and won and flag and visible and not errors):
                    failed = True
                page.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    (OUT / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    (OUT / "seed.txt").write_text(f"{SEED}\n")
    print(json.dumps({"seed": SEED, "failed": failed, "pages": [row["file"] for row in results["pages"]]}))
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
