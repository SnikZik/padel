#!/usr/bin/env python3
"""Embed data/products.json into every page that carries the products:start / products:end markers
(index.html, shop/index.html, shop/product.html) so the catalogue renders with no fetch: also when
a page is opened straight from disk. Run after every edit of data/products.json:
    python3 tools/sync_products.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "shop/index.html", "shop/product.html"]

catalogue = json.loads((ROOT / "data/products.json").read_text(encoding="utf-8"))
payload = json.dumps(catalogue, ensure_ascii=False).replace("<", "\\u003c")
block = ('<!-- products:start / generated from data/products.json by tools/sync_products.py, do not edit by hand -->\n'
         f'<script type="application/json" id="product-data">{payload}</script>\n'
         '<!-- products:end -->')

for rel in PAGES:
    path = ROOT / rel
    html = path.read_text(encoding="utf-8")
    new_html, n = re.subn(r"<!-- products:start.*?<!-- products:end -->", block, html, flags=re.S)
    if n != 1:
        raise SystemExit(f"{rel}: products:start / products:end markers not found exactly once")
    path.write_text(new_html, encoding="utf-8")
    print(f"{rel}: embedded {len(catalogue['products'])} products")
