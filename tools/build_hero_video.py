#!/usr/bin/env python3
"""Hero media: the client's own videos from the locked handoff, used as supplied (Snir, 4.10.2026).

Sources (handoff/04_video, the client's files):
  hero_desktop.mp4  1920x1080, 24 fps, 12 s, drone pass over the venue  -> tablets and desktop (>= 768px)
  hero_mobile.mp4   1080x1920, 24 fps, 12 s, the same pass in portrait  -> phones

Output: assets/video/hero_desktop.mp4 and hero_mobile.mp4 (picture untouched, only re-muxed so the moov atom
sits at the front for streaming) and assets/img/hero_desktop.webp / hero_mobile.webp, each video's exact first
frame, so the poster never jumps into the video.

The files loop with a visible cut (first and last frame differ); add a dissolve here if that is ever wanted.
Earlier hero media, kept for reference: handoff-extra/hero-desktop-2026-09-17b (generated rooftop loop),
handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4 (the walkthrough reel the phones used until 4.10).

usage: python3 tools/build_hero_video.py
"""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS = [("handoff/04_video/hero_desktop.mp4", "assets/video/hero_desktop.mp4", "assets/img/hero_desktop.webp"),
        ("handoff/04_video/hero_mobile.mp4", "assets/video/hero_mobile.mp4", "assets/img/hero_mobile.webp")]

for src_rel, mp4_rel, poster_rel in JOBS:
    src, mp4, poster = ROOT / src_rel, ROOT / mp4_rel, ROOT / poster_rel
    if not src.exists():
        raise SystemExit(f"source missing: {src}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c", "copy", "-movflags", "+faststart", "-an", str(mp4)], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "first.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-frames:v", "1", str(png)], check=True)
        subprocess.run(["cwebp", "-quiet", "-q", "84", str(png), "-o", str(poster)], check=True)
    size = mp4.stat().st_size / 1e6
    print(f"{mp4_rel}: {size:.1f} MB · {poster_rel}: first frame")
