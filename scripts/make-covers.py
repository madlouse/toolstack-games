#!/usr/bin/env python3
"""R3 covers: full-bleed 16:9 from a clean in-game frame (HUD hidden, captured live at 1920x1080),
game name only (CrazyGames cover rules), no bars. Outputs cover 1920/1280, thumb 640, og 1200x630."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT = Path(__file__).resolve().parent.parent / "assets/games"
FONT = "/usr/share/fonts/truetype/sand-box/google/Space Grotesk/SpaceGrotesk-VariableFont_wght.ttf"
GAMES = {  # slug: (title, 16:9 crop box on the 1920x1080 clean frame, centre x for square/portrait crops)
    "spud-fling": ("Spud Fling", (300, 40, 1920, 951), 1190),
    "pips-bloom-isle": ("Pip's Bloom Isle", (0, 0, 1920, 1080), 960),
    "merge-tiles": ("Merge Tiles", (0, 0, 1920, 1080), 960),  # H-09 classic: clean frame = live tsl-classics board slice
    "moon-rover": ("Moon Rover: Anaxagoras", (0, 0, 1920, 1080), 960),  # REGOLITH classic: clean frame captured live at tsl-classics/moon-rover (HUD hidden)
}

def font(px):
    f = ImageFont.truetype(FONT, px)
    try: f.set_variation_by_axes([700])
    except Exception: pass
    return f

def titled(im, title):
    w, h = im.size
    im = im.convert("RGBA")
    # soft top scrim so white title reads on sky/foliage (not a bar: gradient to 0)
    scrim = Image.new("L", (1, h))
    for y in range(h): scrim.putpixel((0, y), max(0, int(120 * (1 - y / (h * 0.42)))))
    shade = Image.new("RGBA", (w, h), (8, 20, 12, 0)); shade.putalpha(scrim.resize((w, h)))
    im = Image.alpha_composite(im, shade)
    px = int(min(h, w * 0.5625) * 0.12); d = ImageDraw.Draw(im)
    while True:
        f = font(px); bb = d.textbbox((0, 0), title, font=f); tw = bb[2] - bb[0]
        if tw <= w * 0.88 or px < 20: break
        px -= 2
    x, y = (w - tw) // 2 - bb[0], int(min(h, w * 0.5625) * 0.07) - bb[1]
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    ds.text((x, y + max(2, px // 15)), title, font=f, fill=(10, 30, 20, 170))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(h * 0.006)))
    ImageDraw.Draw(im).text((x, y), title, font=f, fill=(255, 255, 255, 255))
    return im.convert("RGB")

for slug, (title, box, cx) in GAMES.items():
    d = ROOT / slug
    frame = Image.open(d / "src/clean-frame-1920.jpg").convert("RGB").crop(box).resize((1920, 1080), Image.Resampling.LANCZOS)
    cover = titled(frame, title)
    cover.save(d / "cover-1920x1080.jpg", quality=86, optimize=True)
    for size, stem, q in (((1280, 720), "cover", 80), ((640, 360), "thumb", 82)):
        im = cover.resize(size, Image.Resampling.LANCZOS)
        im.save(d / f"{stem}.jpg", quality=q + 4, optimize=True, progressive=True); im.save(d / f"{stem}.webp", quality=q, method=6)
    for (cw, ch) in ((800, 800), (800, 1200)):  # CrazyGames-style square / portrait, centre crop, re-titled
        sw = int(1080 * cw / ch); x0 = max(0, min(1920 - sw, cx - sw // 2))
        raw = Image.open(d / "src/clean-frame-1920.jpg").convert("RGB")
        im = raw.crop((x0, 0, x0 + sw, 1080)).resize((cw, ch), Image.Resampling.LANCZOS)
        titled(im, title).save(d / f"cover-{cw}x{ch}.jpg", quality=84, optimize=True)
    # OG 1200x630: same frame, centre crop to 1.905, title re-laid (no bars)
    fw = 1920; fh = int(fw / (1200 / 630)); y0 = (1080 - fh) // 2
    og = titled(frame.crop((0, y0, fw, y0 + fh)).resize((1200, 630), Image.Resampling.LANCZOS), title)
    og.save(d / "og.jpg", quality=84, optimize=True, progressive=True)
    print(slug, [(p.name, p.stat().st_size) for p in sorted(d.glob("*")) if p.is_file()])

# Low-res placeholders for lazy screenshots (CURRENT-AUDIT P2-7): 32x18, blurred via CSS
for slug in GAMES:
    for p in sorted((ROOT / slug / "screenshots").glob("*.jpg")):
        if p.stem.endswith("-lqip"): continue
        Image.open(p).convert("RGB").resize((32, 18), Image.Resampling.BILINEAR).save(p.with_name(p.stem + "-lqip.jpg"), quality=60)

# Home OG 1200x630: the two clean frames full-bleed side by side + site name (no bars, ASCII only)
halves = []
for slug, cx in (("spud-fling", 980), ("pips-bloom-isle", 960)):
    raw = Image.open(ROOT / slug / "src/clean-frame-1920.jpg").convert("RGB")
    sw = int(1080 * 600 / 630); x0 = max(0, min(1920 - sw, cx - sw // 2))
    halves.append(raw.crop((x0, 0, x0 + sw, 1080)).resize((600, 630), Image.Resampling.LANCZOS))
home = Image.new("RGB", (1200, 630)); home.paste(halves[0], (0, 0)); home.paste(halves[1], (600, 0))
home = titled(home, "Toolstack Lab Games")
d = ImageDraw.Draw(home, "RGBA"); f = font(40); sub = "Free 3D browser games · no download, no account"
bb = d.textbbox((0, 0), sub, font=f); tw = bb[2] - bb[0]
d.rounded_rectangle(((1200 - tw) // 2 - 24, 540, (1200 + tw) // 2 + 24, 600), 30, fill=(8, 20, 12, 170))
d.text(((1200 - tw) // 2 - bb[0], 570 - (bb[1] + bb[3]) // 2), sub, font=f, fill=(255, 255, 255, 255))
out = ROOT.parent
home.save(out / "og.jpg", quality=86, optimize=True, progressive=True); home.quantize(256).save(out / "og.png", optimize=True)
print("home og", home.size)
