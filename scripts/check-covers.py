#!/usr/bin/env python3
"""Regression check for R3 P1 classes 'Pip cover = real in-game frame' and 'Spud thumbnail black bars'.
For each game in make-covers.py GAMES: thumb.jpg / cover.jpg must (a) be 16:9, (b) have no near-black/near-white
edge band >=4% (letterbox), (c) match the clean HUD-less in-game frame (assets/games/<slug>/src/clean-frame-1920.jpg)
below the title scrim (mean abs diff < 14/255) — a menu screenshot or a different image fails (c).
Usage: python3 scripts/check-covers.py [extra image to test as <slug>=<path> ...]   exit 1 on any failure."""
import ast, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
HUB = Path(__file__).resolve().parent.parent
src = (HUB / "scripts/make-covers.py").read_text()
GAMES = next(ast.literal_eval(n.value) for n in ast.parse(src).body
             if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "GAMES")

def bands(im):
    g = im.convert("L"); w, h = g.size; out = []
    for name, box in (("left", (0, 0, int(w * .04), h)), ("right", (w - int(w * .04), 0, w, h)),
                      ("top", (0, 0, w, int(h * .04))), ("bottom", (0, h - int(h * .04), w, h))):
        st = ImageStat.Stat(g.crop(box))
        if st.stddev[0] < 6 and (st.mean[0] < 40 or st.mean[0] > 245): out.append(f"{name} band lum {st.mean[0]:.0f}")
    return out

def check(slug, path):
    im = Image.open(path).convert("RGB"); w, h = im.size; errs = []
    if abs(w / h - 16 / 9) > 0.02: errs.append(f"ratio {w}x{h} not 16:9")
    errs += bands(im)
    _, box, _ = GAMES[slug]
    ref = Image.open(HUB / f"assets/games/{slug}/src/clean-frame-1920.jpg").convert("RGB").crop(box).resize((w, h), Image.Resampling.LANCZOS)
    region = (0, int(h * .35), w, h)  # below the title scrim
    diff = sum(ImageStat.Stat(ImageChops.difference(im.crop(region), ref.crop(region))).mean) / 3
    if diff >= 14: errs.append(f"not the clean in-game frame (mean diff {diff:.1f})")
    print(("FAIL" if errs else "PASS"), slug, path, f"diff={diff:.1f}", "; ".join(errs))
    return not errs

ok = True
for slug in GAMES:
    for f in ("thumb.jpg", "cover.jpg"):
        ok &= check(slug, HUB / f"assets/games/{slug}/{f}")
for arg in sys.argv[1:]:
    slug, p = arg.split("=", 1); ok &= check(slug, p)
sys.exit(0 if ok else 1)
