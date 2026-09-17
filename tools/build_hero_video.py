#!/usr/bin/env python3
"""Tablet and desktop hero (>= 768px): the rooftop padel and basketball loop Snir supplied (17.9.2026, second version),
handoff-extra/hero-desktop-2026-09-17b/hero-padel-basketball-loop.mp4 (1920x1080, 24 fps, 19.2 s, already a seamless loop).

Output: assets/video/hero_desktop.mp4 (stream copied, moov atom moved to the front for streaming) and
assets/img/hero_desktop.webp, its exact first frame, so the poster never jumps into the video.
Phones keep the club's walkthrough reel (tools/build_hero_video_mobile.py). This script never touches the phone files.

usage: python3 tools/build_hero_video.py
"""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff-extra/hero-desktop-2026-09-17b/hero-padel-basketball-loop.mp4"
MP4 = ROOT / "assets/video/hero_desktop.mp4"
POSTER = ROOT / "assets/img/hero_desktop.webp"

if not SRC.exists():
    raise SystemExit(f"source missing: {SRC}")

# the supplied file is already H.264 1920x1080 and loops: keep the picture untouched, only re-mux for streaming
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-c", "copy", "-movflags", "+faststart", "-an", str(MP4)], check=True)

with tempfile.TemporaryDirectory() as tmp:
    png = Path(tmp) / "first.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(MP4), "-frames:v", "1", str(png)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "84", str(png), "-o", str(POSTER)], check=True)

size = MP4.stat().st_size / 1e6
print(f"{MP4.relative_to(ROOT)}: {size:.1f} MB\n{POSTER.relative_to(ROOT)}: first frame of the video")
