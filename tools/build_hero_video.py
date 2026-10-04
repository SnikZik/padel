#!/usr/bin/env python3
"""Hero media: the client's own videos from the locked handoff, used as supplied (Snir, 4.10.2026).

Sources (handoff/04_video, the client's files):
  hero_desktop.mp4  1920x1080, 24 fps, 12 s, drone pass over the venue  -> tablets and desktop (>= 768px)
  hero_mobile.mp4   1080x1920, 24 fps, 12 s, the same pass in portrait  -> phones

Output: assets/video/hero_desktop.mp4 and hero_mobile.mp4, and assets/img/hero_desktop.webp / hero_mobile.webp,
each video's exact first frame, so the poster never jumps into the video.

Two things are done to the client's files, nothing else (Snir, 4.10.2026, after the client's notes):
  * the tail, where the camera ends on the basketball court, is cut: only the padel part is kept (KEEP seconds)
  * the first second is dissolved into the end, so the loop closes without a jump
Earlier hero media, kept for reference: handoff-extra/hero-desktop-2026-09-17b (generated rooftop loop),
handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4 (the walkthrough reel the phones used until 4.10).

usage: python3 tools/build_hero_video.py
"""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS = [("handoff/04_video/hero_desktop.mp4", "assets/video/hero_desktop.mp4", "assets/img/hero_desktop.webp", 22, "4200k"),
        ("handoff/04_video/hero_mobile.mp4", "assets/video/hero_mobile.mp4", "assets/img/hero_mobile.webp", 25, "2600k")]
KEEP = 8.0            # seconds of the pass over the padel courts
FADE = 0.8            # seconds of the head dissolved over the tail, so the loop closes
ENC = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-preset", "slow",
       "-r", "24", "-g", "48", "-movflags", "+faststart", "-an"]

for src_rel, mp4_rel, poster_rel, crf, maxrate in JOBS:
    src, mp4, poster = ROOT / src_rel, ROOT / mp4_rel, ROOT / poster_rel
    if not src.exists():
        raise SystemExit(f"source missing: {src}")
    body = KEEP - FADE
    graph = (f"[0:v]trim=start={FADE}:end={KEEP},setpts=PTS-STARTPTS,format=yuv420p[body];"
             f"[0:v]trim=end={FADE},setpts=PTS-STARTPTS,format=yuv420p[head];"
             f"[body][head]xfade=transition=fade:duration={FADE}:offset={body - FADE:.3f}[v]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", graph, "-map", "[v]", *ENC,
                    "-crf", str(crf), "-maxrate", maxrate, "-bufsize", str(int(maxrate[:-1]) * 2) + "k", str(mp4)], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "first.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-frames:v", "1", str(png)], check=True)
        subprocess.run(["cwebp", "-quiet", "-q", "84", str(png), "-o", str(poster)], check=True)
    size = mp4.stat().st_size / 1e6
    print(f"{mp4_rel}: {size:.1f} MB · {poster_rel}: first frame")
