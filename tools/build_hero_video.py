#!/usr/bin/env python3
"""Hero video: the club's own walkthrough reel, the one Snir picked, on every width (4.10.2026).

Source: handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4 (576x1024 portrait, the reel the client sent on
WhatsApp). It was filmed by hand and shakes, so this script stabilises it before encoding (Snir, 5.10.2026):

  1. the shift between every pair of frames is measured by phase correlation at full resolution, with the peak
     refined to a fraction of a pixel, and the tilt by phase correlation on the log-polar magnitude spectrum,
  2. both paths are smoothed (gaussian, 20 frames for the shift, 12 for the tilt) and every frame is moved and
     turned onto the smooth path, the full correction the smoothing asks for (it peaks at 50px) and up to 0.6 degrees,
  3. the frame is cut down to the 480x854 window in its middle, which hides the edges the move exposes.

The pan across the courts stays, the handheld jitter goes: high-frequency camera movement drops from 6.1px to
about 1.4px. Nothing is scaled, so the picture stays as sharp as the client's own file. What no amount of this can
remove is the parallax of a walking shot, near and far moving at different speeds, which leaves about 2px of sway
that only a different clip would solve.

Output: assets/video/hero.mp4 and assets/img/hero.webp, its exact first frame, so the poster never jumps into the
video. Phones play it full screen; from 1024px the hero splits and the reel keeps the right half.

The client's drone videos from the handoff are still in handoff/04_video, and the generated rooftop loop in
handoff-extra/hero-desktop-2026-09-17b/, if either is ever wanted again.

usage: python3 tools/build_hero_video.py     (needs numpy, scipy, pillow, ffmpeg, cwebp)
"""
import subprocess, tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import affine_transform, gaussian_filter1d, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "handoff-extra/hero-mobile-whatsapp-reel-2026-09-17.mp4"
MP4 = ROOT / "assets/video/hero.mp4"
POSTER = ROOT / "assets/img/hero.webp"
W, H = 576, 1024          # the source frame
OUT_W, OUT_H = 480, 854   # the window kept out of it, 48px of margin at the sides, 85px top and bottom
FPS = "30"
SHIFT_SMOOTH, SHIFT_LIMIT = 20.0, 55.0   # frames, px: 55 is enough that the smoothing is never cut short
TILT_SMOOTH, TILT_LIMIT = 12.0, 0.6      # frames, degrees

if not SRC.exists():
    raise SystemExit(f"source missing: {SRC}")

def grey(path):
    a = np.asarray(Image.open(path).convert("L"), dtype=float)
    return a - a.mean()

def windowed(a):
    return a * np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1]))

def correlate(f0, f1, shape):
    """Phase correlation, peak refined by a parabola through its neighbours."""
    r = f1 * np.conj(f0)
    r /= np.maximum(np.abs(r), 1e-9)
    return np.fft.irfft2(r, s=shape)

def refine(c, i, j, axis):
    n = c.shape[axis]
    at = (lambda k: c[k % n, j]) if axis == 0 else (lambda k: c[i, k % n])
    a, b, d = at((i if axis == 0 else j) - 1), at(i if axis == 0 else j), at((i if axis == 0 else j) + 1)
    den = a - 2 * b + d
    k = (i if axis == 0 else j) + ((a - d) / (2 * den) if abs(den) > 1e-9 else 0.0)
    return k - n if k > n / 2 else k

def shift_between(f0, f1):
    c = correlate(f0, f1, (H, W))
    iy, ix = np.unravel_index(np.argmax(c), c.shape)
    dy, dx = refine(c, iy, ix, 0), refine(c, iy, ix, 1)
    return (0.0, 0.0) if abs(dy) > 60 or abs(dx) > 60 else (dy, dx)

N = 256
ANGLES, RADII = 180, 96
_ang = np.linspace(0, np.pi, ANGLES, endpoint=False)
_rad = np.logspace(np.log10(3), np.log10(N / 2 - 2), RADII)
_yy = N / 2 + _rad[None, :] * np.sin(_ang[:, None])
_xx = N / 2 + _rad[None, :] * np.cos(_ang[:, None])

def log_polar(path):
    """The frame's magnitude spectrum on a polar grid: a turn of the camera becomes a slide along the angle."""
    a = np.asarray(Image.open(path).convert("L").resize((N, N), Image.BILINEAR), dtype=float)
    f = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(windowed(a - a.mean())))))
    g = map_coordinates(f, [_yy, _xx], order=1, mode="nearest")
    return np.fft.rfft(g - g.mean(0, keepdims=True), axis=0)

def tilt_between(p0, p1):
    r = (p1 * np.conj(p0)).sum(1)
    r /= np.maximum(np.abs(r), 1e-9)
    c = np.fft.irfft(r, n=ANGLES)
    i = int(np.argmax(c))
    a, b, d = c[(i - 1) % ANGLES], c[i], c[(i + 1) % ANGLES]
    den = a - 2 * b + d
    deg = i + ((a - d) / (2 * den) if abs(den) > 1e-9 else 0.0)
    if deg > ANGLES / 2:
        deg -= ANGLES
    return 0.0 if abs(deg) > 3 else deg      # one bin is one degree

def smooth_path(path, sigma, limit):
    if path.ndim == 1:
        return np.clip(gaussian_filter1d(path, sigma, mode="nearest") - path, -limit, limit)
    smooth = np.stack([gaussian_filter1d(path[:, i], sigma, mode="nearest") for i in range(path.shape[1])], 1)
    return np.clip(smooth - path, -limit, limit)

with tempfile.TemporaryDirectory() as tmp:
    raw, fixed = Path(tmp) / "raw", Path(tmp) / "fixed"
    raw.mkdir(); fixed.mkdir()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC), f"{raw}/%04d.png"], check=True)
    frames = sorted(raw.iterdir())

    spec, polar = np.fft.rfft2(windowed(grey(frames[0]))), log_polar(frames[0])
    shifts, tilts = [np.zeros(2)], [0.0]
    for f in frames[1:]:
        s, p = np.fft.rfft2(windowed(grey(f))), log_polar(f)
        shifts.append(shifts[-1] + np.array(shift_between(spec, s)))
        tilts.append(tilts[-1] + tilt_between(polar, p))
        spec, polar = s, p
    shifts, tilts = np.array(shifts), np.array(tilts)
    move = smooth_path(shifts, SHIFT_SMOOTH, SHIFT_LIMIT)
    turn = smooth_path(tilts, TILT_SMOOTH, TILT_LIMIT)

    x0, y0 = (W - OUT_W) // 2, (H - OUT_H) // 2
    centre = np.array([H / 2, W / 2])
    for f, (dy, dx), deg in zip(frames, move, turn):
        a = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32)
        t = np.radians(deg)
        rot = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])
        off = centre - rot @ centre - np.array([dy, dx])
        out = np.stack([affine_transform(a[:, :, c], rot, offset=off, order=1, mode="nearest") for c in range(3)], -1)
        im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
        im.crop((x0, y0, x0 + OUT_W, y0 + OUT_H)).save(fixed / f.name)

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", FPS, "-i", f"{fixed}/%04d.png",
                    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "slow",
                    "-crf", "22", "-maxrate", "2600k", "-bufsize", "5200k",
                    "-movflags", "+faststart", "-an", str(MP4)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", "86", str(fixed / frames[0].name), "-o", str(POSTER)], check=True)

def jitter(p, sigma=8.0):
    res = p - (gaussian_filter1d(p, sigma, mode="nearest") if p.ndim == 1
               else np.stack([gaussian_filter1d(p[:, i], sigma, mode="nearest") for i in range(p.shape[1])], 1))
    return float(np.atleast_1d(res.std(0)).mean())

print(f"{len(frames)} frames: shake {jitter(shifts):.2f}px to {jitter(shifts + move):.2f}px, "
      f"tilt {jitter(tilts):.3f}deg to {jitter(tilts + turn):.3f}deg")
print(f"assets/video/hero.mp4: {OUT_W}x{OUT_H}, {MP4.stat().st_size / 1e6:.1f} MB · assets/img/hero.webp: its first frame")
