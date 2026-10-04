#!/usr/bin/env python3
"""Hero video: the club's own walkthrough reel, the one Snir picked, on every width (4.10.2026).

Source: handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4 (576x1024 portrait, the reel the client sent on
WhatsApp, already cut and closed into a loop when the site was first built).

Output: assets/video/hero.mp4 (stream copied, moov atom at the front) and assets/img/hero.webp, its exact first
frame, so the poster never jumps into the video. Phones play it full screen; from 768px the page shows the portrait
reel sharp in the middle of the hero over a blurred, darkened copy of its own first frame, because a 576px wide file
cannot fill a desktop screen without smearing.

The client's drone videos from the handoff are still in handoff/04_video, and the generated rooftop loop in
handoff-extra/hero-desktop-2026-09-17b/, if either is ever wanted again.

usage: python3 tools/build_hero_video.py
"""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4"
MP4 = ROOT / "assets/video/hero.mp4"
POSTER = ROOT / "assets/img/hero.webp"

if not SRC.exists():
    raise SystemExit(f"source missing: {SRC}")

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-c", "copy", "-movflags", "+faststart", "-an", str(MP4)], check=True)
with tempfile.TemporaryDirectory() as tmp:
    png = Path(tmp) / "first.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(MP4), "-frames:v", "1", str(png)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "86", str(png), "-o", str(POSTER)], check=True)
print(f"assets/video/hero.mp4: {MP4.stat().st_size / 1e6:.1f} MB · assets/img/hero.webp: first frame")
