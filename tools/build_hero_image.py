#!/usr/bin/env python3
"""Desktop hero image (>= 768px): a composed crop of the real aerial photo, lightly graded.

Source: handoff/03_venue_photos/originals/court_03.jpg (the wide shot of the whole venue).
Crop keeps the pink courts as the visual hero with the deck and shade, drops the foreground planter,
cones and the far right edge (so the basketball court does not dominate), then: +6% contrast,
+10% colour, gentle unsharp mask, soft vignette. No retouching, no generated content.
Output: assets/img/hero_desktop.webp 1920x1080.

usage: python3 tools/build_hero_image.py
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff/03_venue_photos/originals/court_03.jpg"
OUT = ROOT / "assets/img/hero_desktop.webp"
BOX = (40, 40, 1516, 870)  # 1476 x 830 = 16:9

im = Image.open(SRC).convert("RGB").crop(BOX).resize((1920, 1080), Image.LANCZOS)
im = ImageEnhance.Contrast(im).enhance(1.06)
im = ImageEnhance.Color(im).enhance(1.10)
im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
w, h = im.size
mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).ellipse((-w * 0.25, -h * 0.35, w * 1.25, h * 1.35), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(220))
im = Image.composite(im, ImageEnhance.Brightness(im).enhance(0.86), mask)

png = OUT.with_suffix(".png")
im.save(png)
subprocess.run(["cwebp", "-quiet", "-q", "86", str(png), "-o", str(OUT)], check=True)
png.unlink()
print(f"{OUT.name}: {im.size}, {OUT.stat().st_size // 1024} KB")
