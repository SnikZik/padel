#!/usr/bin/env python3
"""Mobile hero video, cut from the club's real walkthrough reel
("WhatsApp Video 2026-09-10 at 11.23.59 (1).mp4", 576x1024, the client's own edit).

Sequence: the pink court passage as it is in the reel (pink court box -> pink net -> bench -> court "3" -> turf),
then the lounge with the logo wall, then a dissolve into a still of the opening frame so the loop is seamless.
Light deshake only (small search window: removes hand jitter, keeps the reel's own slow moves), no zoom, no pan.
Poster = the exact first frame. Output stays at the source resolution (no fake upscale).

usage: python3 tools/build_hero_video.py "/path/to/WhatsApp Video 2026-09-10 at 11.23.59 (1).mp4"
"""
import subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads/WhatsApp Video 2026-09-10 at 11.23.59 (1).mp4"
OUT = ROOT / "assets/video/hero_mobile.mp4"
POSTER = ROOT / "assets/img/hero_mobile.webp"
W, H, FPS = 576, 1024, 30
FADE = 0.8
SEGMENTS = [(20.05, 27.40), (16.35, 19.90)]   # (start, end) seconds in the source reel
STABLE = "deshake=rx=16:ry=16:edge=mirror:blocksize=8:contrast=125,scale=iw*1.04:ih*1.04,crop=%d:%d" % (W, H)
ENC = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-preset", "slow",
       "-r", str(FPS), "-g", str(FPS * 2), "-movflags", "+faststart", "-an"]

def run(cmd): subprocess.run(cmd, check=True)

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    clips = []
    for i, (a, b) in enumerate(SEGMENTS):
        clip = tmp / f"s{i}.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(b - a), "-i", str(SRC),
             "-vf", f"{STABLE},format=yuv420p", *ENC, "-crf", "16", str(clip)])
        clips.append((clip, b - a))
    # still of the opening frame for the loop tail
    first = tmp / "first.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(clips[0][0]), "-frames:v", "1", str(first)])
    tail = tmp / "tail.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", str(FADE + 0.15), "-i", str(first),
         "-vf", "format=yuv420p", *ENC, "-crf", "16", str(tail)])
    clips.append((tail, FADE + 0.15))
    # dissolve chain
    inputs, chain, length, prev = [], [], clips[0][1], "0:v"
    for i, (clip, dur) in enumerate(clips):
        inputs += ["-i", str(clip)]
    for i in range(1, len(clips)):
        out = "v" if i == len(clips) - 1 else f"x{i}"
        chain.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={FADE}:offset={length - FADE:.2f}[{out}]")
        length += clips[i][1] - FADE
        prev = out
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-map", "[v]",
         *ENC, "-crf", "21", "-maxrate", "2200k", "-bufsize", "4400k", str(OUT)])
    # poster = first frame of the finished file
    png = tmp / "poster.png"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT), "-frames:v", "1", str(png)])
    run(["cwebp", "-quiet", "-q", "86", str(png), "-o", str(POSTER)])

probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,pix_fmt,duration", "-of", "csv=p=0", str(OUT)], capture_output=True, text=True).stdout.strip()
print(f"{OUT.name}: {probe} {OUT.stat().st_size/1e6:.1f} MB; poster {POSTER.name} {POSTER.stat().st_size//1024} KB")
