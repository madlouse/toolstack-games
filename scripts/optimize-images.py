#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/workspace/exp28-games/game-hub/assets/games")
SITE = Path("/workspace/exp28-games/game-hub/assets")


def optimize_shot(png_path: Path, out_dir: Path, stem: str):
    im = Image.open(png_path).convert("RGB")
    w, h = im.size
    if w > 1280:
        nh = int(h * 1280 / w)
        im = im.resize((1280, nh), Image.Resampling.LANCZOS)
    jpg = out_dir / f"{stem}.jpg"
    webp = out_dir / f"{stem}.webp"
    im.save(jpg, "JPEG", quality=82, optimize=True)
    im.save(webp, "WEBP", quality=78, method=4)
    print(f"  {jpg.name} {jpg.stat().st_size}B  {webp.name} {webp.stat().st_size}B")
    return im


def make_thumb(im: Image.Image, thumb_dir: Path):
    # card 640x360
    src = im.copy()
    src.thumbnail((640, 360), Image.Resampling.LANCZOS)
    card = Image.new("RGB", (640, 360), (14, 18, 24))
    x = (640 - src.width) // 2
    y = (360 - src.height) // 2
    card.paste(src, (x, y))
    card.save(thumb_dir / "thumb.jpg", "JPEG", quality=85, optimize=True)
    card.save(thumb_dir / "thumb.webp", "WEBP", quality=80, method=4)
    print(f"  thumb {thumb_dir/'thumb.jpg'} { (thumb_dir/'thumb.jpg').stat().st_size}B")


def make_og():
    # 1200x630 from two game frames + site name
    frames = []
    for slug in ("spud-fling", "pips-bloom-isle"):
        p = ROOT / slug / "screenshots" / "01-title.jpg"
        if p.exists():
            frames.append(Image.open(p).convert("RGB"))
    if not frames:
        raise SystemExit("no frames for og")
    og = Image.new("RGB", (1200, 630), (12, 16, 22))
    # left / right panels
    for i, fr in enumerate(frames[:2]):
        # cover crop
        tw, th = 580, 420
        scale = max(tw / fr.width, th / fr.height)
        nw, nh = int(fr.width * scale), int(fr.height * scale)
        fr2 = fr.resize((nw, nh), Image.Resampling.LANCZOS)
        left = (nw - tw) // 2
        top = (nh - th) // 2
        crop = fr2.crop((left, top, left + tw, top + th))
        x = 20 + i * (580 + 20)
        y = 70
        # rounded-ish by just paste
        og.paste(crop, (x, y))
    draw = ImageDraw.Draw(og)
    # dark bar at top
    draw.rectangle([0, 0, 1200, 58], fill=(8, 12, 18))
    font_paths = [
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    ]
    # find Noto variable
    import glob
    cands = font_paths + glob.glob("/usr/share/fonts/**/*NotoSans*.ttf", recursive=True)
    cands += glob.glob("/usr/share/fonts/**/*DejaVuSans-Bold*.ttf", recursive=True)
    font = None
    for fp in cands:
        try:
            font = ImageFont.truetype(fp, 28)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
    title = "Toolstack Lab · AI 3D 游戏合集"
    # measure
    try:
        bbox = draw.textbbox((0, 0), title, font=font)
        tw = bbox[2] - bbox[0]
    except Exception:
        tw = len(title) * 12
    draw.text(((1200 - tw) // 2, 14), title, fill=(240, 244, 250), font=font)
    # bottom tagline
    draw.rectangle([0, 560, 1200, 630], fill=(8, 12, 18))
    small = font
    try:
        small = ImageFont.truetype(cands[0] if cands else font_paths[0], 20)
    except Exception:
        pass
    tag = "Browser 3D games · games.gettoolstacklab.com"
    try:
        bbox = draw.textbbox((0, 0), tag, font=small)
        tw = bbox[2] - bbox[0]
    except Exception:
        tw = len(tag) * 10
    draw.text(((1200 - tw) // 2, 582), tag, fill=(180, 190, 205), font=small)
    out = SITE / "og.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    og.save(out, "PNG", optimize=True)
    # also jpg for size
    og.save(SITE / "og.jpg", "JPEG", quality=88, optimize=True)
    print(f"og -> {out} {out.stat().st_size}B")


def main():
    for slug in ("spud-fling", "pips-bloom-isle"):
        raw_dir = ROOT / slug / "screenshots" / "_raw"
        out_dir = ROOT / slug / "screenshots"
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"== optimize {slug} ==")
        first = None
        for png in sorted(raw_dir.glob("*.png")):
            im = optimize_shot(png, out_dir, png.stem)
            if first is None:
                first = im
        if first is not None:
            make_thumb(first, ROOT / slug)
    # Prefer official Spud thumb if present
    official = Path("/workspace/exp28-games/game1/portal-package/gamemonetize-v3/thumb-512x340.jpg")
    if official.exists():
        im = Image.open(official).convert("RGB")
        # scale to 640x360
        card = Image.new("RGB", (640, 360), (14, 18, 24))
        im2 = im.copy()
        im2.thumbnail((640, 360), Image.Resampling.LANCZOS)
        x = (640 - im2.width) // 2
        y = (360 - im2.height) // 2
        card.paste(im2, (x, y))
        d = ROOT / "spud-fling"
        card.save(d / "thumb.jpg", "JPEG", quality=88, optimize=True)
        card.save(d / "thumb.webp", "WEBP", quality=82, method=4)
        print("  used official Spud thumb")
    make_og()
    # favicon from spud thumb corner
    thumb = ROOT / "spud-fling" / "thumb.jpg"
    if thumb.exists():
        im = Image.open(thumb).convert("RGB").resize((64, 64), Image.Resampling.LANCZOS)
        im.save(SITE / "favicon-64.png", "PNG")
        im.resize((32, 32)).save(SITE / "favicon.png", "PNG")
        # ico via png rename fallback - browsers accept png as favicon
        print("favicon ok")


if __name__ == "__main__":
    main()
