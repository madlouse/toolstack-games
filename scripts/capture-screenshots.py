#!/usr/bin/env python3
"""Capture 3+ real screenshots from live game URLs for the hub."""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME = "/home/box/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-sandbox",
    "--disable-dev-shm-usage",
]

ROOT = Path("/workspace/exp28-games/game-hub/assets/games")

GAMES = [
    {
        "slug": "spud-fling",
        "url": "https://tsl-game1.pages.dev/?internal=1",
        "shots": [
            ("01-title", 2.5, None),
            ("02-charging", 1.0, "charge"),
            ("03-flight", 2.0, "launch"),
        ],
    },
    {
        "slug": "pips-bloom-isle",
        "url": "https://bloom-isle.gettoolstacklab.com/?internal=1&low=1",
        "shots": [
            ("01-title", 3.5, None),
            ("02-world", 2.0, "enter"),
            ("03-play", 2.5, "move"),
        ],
    },
]


def interact(page, action, slug):
    if action is None:
        return
    if slug == "spud-fling":
        if action == "charge":
            page.keyboard.down("Space")
            time.sleep(0.65)
        elif action == "launch":
            page.keyboard.down("Space")
            time.sleep(0.55)
            page.keyboard.up("Space")
            time.sleep(1.3)
    elif slug == "pips-bloom-isle":
        if action == "enter":
            page.keyboard.press("Enter")
            time.sleep(1.0)
            page.keyboard.press("Enter")
            time.sleep(1.5)
        elif action == "move":
            page.keyboard.press("Enter")
            time.sleep(0.8)
            page.keyboard.press("Enter")
            time.sleep(1.0)
            page.keyboard.down("KeyW")
            time.sleep(1.2)
            page.keyboard.up("KeyW")
            page.keyboard.press("Digit1")
            time.sleep(0.8)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=ARGS, headless=True)
        for g in GAMES:
            out = ROOT / g["slug"] / "screenshots" / "_raw"
            out.mkdir(parents=True, exist_ok=True)
            print(f"== {g['slug']} ==")
            context = browser.new_context(
                viewport={"width": 1280, "height": 720},
                device_scale_factor=1,
            )
            page = context.new_page()
            page.goto(g["url"], wait_until="domcontentloaded", timeout=90000)
            try:
                page.wait_for_selector("canvas", timeout=25000)
                print("  canvas ready")
            except Exception as e:
                print(f"  warn: canvas wait: {e}")
            time.sleep(2.0)
            for stem, wait_s, action in g["shots"]:
                interact(page, action, g["slug"])
                time.sleep(wait_s)
                raw = out / f"{stem}.png"
                page.screenshot(path=str(raw), type="png")
                print(f"  shot {raw} ({raw.stat().st_size} B)")
                if action == "charge":
                    page.keyboard.up("Space")
            context.close()
        browser.close()
    print("capture done")


if __name__ == "__main__":
    main()
