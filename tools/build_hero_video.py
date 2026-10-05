#!/usr/bin/env python3
"""Hero video: the club's own walkthrough reel, the one Snir picked, on every width (4.10.2026).

Source: handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4 (576x1024 portrait, the reel the client sent on
WhatsApp, already cut and closed into a loop when the site was first built). It was filmed by hand and shakes
(Snir, 5.10.2026), so this script stabilises it before encoding:

  1. the translation between every pair of frames is measured by phase correlation on a half-size, windowed copy,
  2. the camera path that comes out is smoothed (gaussian, sigma 12 frames) and each frame is moved onto the
     smooth path, by at most 22px so the shift never outruns the crop,
  3. a 92% centre crop hides the edges the shift exposes, and the frame is scaled back to 576x1024.

Only translation is corrected: the pan across the courts stays, the handheld jitter goes (2.37px to 1.74px of
camera movement between frames).

Output: assets/video/hero.mp4 and assets/img/hero.webp, its exact first frame, so the poster never jumps into the
video. Phones play it full screen; from 1024px the hero splits, the reel keeps one half at close to its own size.

The client's drone videos from the handoff are still in handoff/04_video, and the generated rooftop loop in
handoff-extra/hero-desktop-2026-09-17b/, if either is ever wanted again.

usage: python3 tools/build_hero_video.py     (needs numpy, scipy, pillow, ffmpeg, cwebp)
"""
import subprocess, tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d, shift as nd_shift

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4"
MP4 = ROOT / "assets/video/hero.mp4"
POSTER = ROOT / "assets/img/hero.webp"
W, H = 576, 1024
FPS = "30"
SMOOTH = 12.0   # frames
LIMIT = 22      # px, must stay inside the crop margin below
CROP = 0.92

if not SRC.exists():
    raise SystemExit(f"source missing: {SRC}")

def spectrum(path):
    """Half-size, mean-removed, windowed frame, ready for phase correlation."""
    a = np.asarray(Image.open(path).convert("L").resize((W // 2, H // 2), Image.BILINEAR), dtype=float)
    a -= a.mean()
    return np.fft.rfft2(a * np.outer(np.hanning(H // 2), np.hanning(W // 2)))

def offset(f0, f1):
    r = f1 * np.conj(f0)
    r /= np.maximum(np.abs(r), 1e-8)
    c = np.fft.irfft2(r, s=(H // 2, W // 2))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    dy = iy - H // 2 if iy > H // 4 else iy
    dx = ix - W // 2 if ix > W // 4 else ix
    if abs(dy) > 30 or abs(dx) > 30:    # a cut, or no match worth trusting
        return 0.0, 0.0
    return dy * 2.0, dx * 2.0

with tempfile.TemporaryDirectory() as tmp:
    raw, fixed = Path(tmp) / "raw", Path(tmp) / "fixed"
    raw.mkdir(); fixed.mkdir()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), f"{raw}/%04d.png"], check=True)
    frames = sorted(raw.iterdir())

    prev, path = spectrum(frames[0]), [np.zeros(2)]
    for f in frames[1:]:
        cur = spectrum(f)
        path.append(path[-1] + np.array(offset(prev, cur)))
        prev = cur
    path = np.array(path)
    smooth = np.stack([gaussian_filter1d(path[:, i], SMOOTH, mode="nearest") for i in range(2)], 1)
    fix = np.clip(smooth - path, -LIMIT, LIMIT)

    for f, (dy, dx) in zip(frames, fix):
        a = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
        if abs(dy) > .05 or abs(dx) > .05:
            a = nd_shift(a, (dy, dx, 0), order=1, mode="nearest")
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        cw, ch = int(W * CROP), int(H * CROP)
        im = im.crop(((W - cw) // 2, (H - ch) // 2, (W - cw) // 2 + cw, (H - ch) // 2 + ch))
        im.resize((W, H), Image.LANCZOS).save(fixed / f.name)

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", FPS, "-i", f"{fixed}/%04d.png",
                    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "slow",
                    "-crf", "23", "-maxrate", "2600k", "-bufsize", "5200k",
                    "-movflags", "+faststart", "-an", str(MP4)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "86", str(fixed / frames[0].name), "-o", str(POSTER)], check=True)

shake = lambda p: round(float(np.abs(np.diff(p, axis=0)).mean()), 2)
print(f"{len(frames)} frames stabilised: camera movement {shake(path)}px to {shake(path + fix)}px between frames")
print(f"assets/video/hero.mp4: {MP4.stat().st_size / 1e6:.1f} MB · assets/img/hero.webp: its first frame")
