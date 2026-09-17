#!/usr/bin/env python3
"""Tablet and desktop hero video (>= 768px), from the locked-off tripod shot Snir supplied (17.9.2026):
handoff-extra/hero-video-source-2026-09-17.mp4 (1916x1080, 24 fps, 15 s, no audio).

Output: assets/video/hero_desktop.mp4 (1920x1080) and assets/img/hero_desktop.webp, its exact first frame.
Phones keep the club's walkthrough reel (tools/build_hero_video_mobile.py). This script never touches the phone files.

Seamless loop: the first second of the shot is dissolved into the end, so the last frame of the file
equals its first frame. No zoom, no pan, no stabiliser (the shot is already locked off).

usage: python3 tools/build_hero_video.py
"""
import subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff-extra/hero-video-source-2026-09-17.mp4"
FADE = 1.0            # seconds of the head dissolved over the tail

ENC = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-preset", "slow",
       "-r", "24", "-g", "48", "-movflags", "+faststart", "-an"]

def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)

def build(out_name, vf, crf, maxrate, poster_name):
    total = duration(SRC)
    body = total - FADE
    out = ROOT / "assets/video" / out_name
    # body = [FADE .. end], head = [0 .. FADE]; dissolve head over the last FADE seconds of body
    graph = (f"[0:v]trim=start={FADE},setpts=PTS-STARTPTS,{vf},format=yuv420p[body];"
             f"[0:v]trim=end={FADE},setpts=PTS-STARTPTS,{vf},format=yuv420p[head];"
             f"[body][head]xfade=transition=fade:duration={FADE}:offset={body - FADE:.3f}[v]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), "-filter_complex", graph, "-map", "[v]",
                    *ENC, "-crf", str(crf), "-maxrate", maxrate, "-bufsize", str(int(maxrate[:-1]) * 2) + "k", str(out)], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "poster.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-frames:v", "1", str(png)], check=True)
        subprocess.run(["cwebp", "-quiet", "-q", "84", str(png), "-o", str(ROOT / "assets/img" / poster_name)], check=True)
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt,duration",
                            "-of", "csv=p=0", str(out)], capture_output=True, text=True).stdout.strip()
    print(f"{out_name}: {probe}, {out.stat().st_size / 1e6:.1f} MB; poster {poster_name}")

build("hero_desktop.mp4", "scale=1920:1080:flags=lanczos", 23, "4500k", "hero_desktop.webp")
