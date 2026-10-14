#!/usr/bin/env python3
"""Tournament gallery: the club's own photos of a finished tournament, prepared for the web (Snir, 14.10.2026).

Source: handoff-extra/tournament-<date>/ (the originals the client sent on WhatsApp, kept out of the public repo).
Output: assets/tournaments/gallery/<date>/ as JPEG and WebP at 720x1280, and the gallery array inside
data/tournaments.json for the tournament with that date, which tools/sync_tournaments.py then renders.

Near-duplicates (the same moment sent twice) are dropped by a difference hash. A photo without the club's own
watermark is a duplicate of one that has it (Snir, 14.10.2026), so those are moved by hand into rejected/ inside
the source folder, which this script does not read. An alt text already written into data/tournaments.json for a
file is kept, so the Hebrew descriptions survive a re-run.

usage: python3 tools/build_tournament_gallery.py 2026-10-02
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LONG_SIDE = 1280
NAME = "משחק-פאדל-אזור"        # the file name itself says what the picture is (Snir, 14.10.2026)
DEFAULT_ALT = "משחק פאדל בטורניר במועדון פאדל קלאב אזור"

def dhash(path, size=8):
    a = np.asarray(Image.open(path).convert("L").resize((size + 1, size), Image.BILINEAR), dtype=int)
    return (a[:, 1:] > a[:, :-1]).flatten()

def main(date):
    src = ROOT / f"handoff-extra/tournament-{date}"
    out = ROOT / f"assets/tournaments/gallery/{date}"
    if not src.is_dir():
        raise SystemExit(f"no originals in {src}")
    out.mkdir(parents=True, exist_ok=True)

    data = json.loads((ROOT / "data/tournaments.json").read_text(encoding="utf-8"))
    tournament = next((t for t in data["tournaments"] if t["date"] == date), None)
    if tournament is None:
        raise SystemExit(f"data/tournaments.json has no tournament on {date}")
    known_alt = {Path(g["src"]).name: g["alt"] for g in tournament.get("gallery") or []}

    kept, hashes = [], []
    for f in sorted(src.iterdir()):
        if f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        h = dhash(f)
        if any((h != o).sum() <= 6 for o in hashes):     # the same moment, sent twice
            print(f"skipped {f.name}: near duplicate")
            continue
        hashes.append(h)
        kept.append(f)

    for old in out.iterdir():
        old.unlink()

    gallery = []
    for i, f in enumerate(kept, 1):
        im = Image.open(f).convert("RGB")
        w, h = im.size
        scale = LONG_SIDE / max(w, h)
        if scale < 1:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        stem = f"{NAME}-{i:02d}"
        im.save(out / f"{stem}.jpg", quality=84, optimize=True, progressive=True)
        im.save(out / f"{stem}.webp", quality=80, method=6)
        rel = f"assets/tournaments/gallery/{date}/{stem}"
        gallery.append({"src": f"{rel}.jpg", "webp": f"{rel}.webp",
                        "width": im.size[0], "height": im.size[1],
                        "alt": known_alt.get(f"{stem}.jpg", DEFAULT_ALT)})

    tournament["gallery"] = gallery
    (ROOT / "data/tournaments.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum((out / Path(g["webp"]).name).stat().st_size for g in gallery)
    print(f"{len(gallery)} photos into {out.relative_to(ROOT)} ({total / 1e6:.1f} MB of WebP), "
          f"data/tournaments.json updated. Run tools/sync_tournaments.py next.")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026-10-02")
