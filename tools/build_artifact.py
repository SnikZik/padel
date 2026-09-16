#!/usr/bin/env python3
"""Build the Claude Artifact preview of the site.

The Artifact host wraps the page in its own <html>/<head>/<body>, so this script
turns index.html into a body-only fragment: inlines the stylesheet, the runtime
config and the product catalogue, and wraps everything in a dir="rtl" container.
Production stays index.html; this output is for review only.

usage: python3 tools/build_artifact.py <output_dir>
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
out_dir = Path(sys.argv[1]).resolve()
out_dir.mkdir(parents=True, exist_ok=True)

html = (ROOT / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)

# head: keep title (shortened to the product name), fonts, preloads, schema. Drop charset/viewport (host adds them).
head = re.sub(r"<meta charset=[^>]*>\s*", "", head)
head = re.sub(r"<meta name=\"viewport\"[^>]*>\s*", "", head)
head = re.sub(r"<title>.*?</title>", "<title>The Padel Club Azor</title>", head, flags=re.S)
css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
head = re.sub(r"<link rel=\"stylesheet\" href=\"assets/css/style.css\">", "<style>\n" + css + "\n</style>", head)

# body: inline the runtime config; the catalogue is already embedded by tools/sync_products.py,
# and the classic scripts stay as published files
config_js = (ROOT / "site.config.js").read_text(encoding="utf-8")
body = body.replace('<script src="site.config.js"></script>', "<script>\n" + config_js + "\n</script>")

page = head.strip() + '\n<div id="page" lang="he" dir="rtl">\n' + body.strip() + "\n</div>\n"
(out_dir / "index.html").write_text(page, encoding="utf-8")

# supporting files, same relative paths as production (the /shop/ pages need the stylesheet and config as files)
for rel in ["assets/js/main.js", "assets/js/shop.js", "assets/js/products/repository.js", "assets/js/products/card.js",
            "assets/css/style.css", "site.config.js", "shop/index.html", "shop/product.html"]:
    dst = out_dir / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dst)
for folder in ["assets/img", "assets/video", "assets/brand", "assets/products"]:
    dst = out_dir / folder
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(ROOT / folder, dst)

files = sorted(str(p.relative_to(out_dir)) for p in out_dir.rglob("*") if p.is_file() and p.name != "index.html")
(out_dir / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
print(f"artifact page: {out_dir / 'index.html'}\nsupporting files: {len(files)}")
