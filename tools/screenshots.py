#!/usr/bin/env python3
"""Full-page screenshots at the review widths.
usage: python3 tools/screenshots.py [port|file]   (default: http://localhost:8766, "file" = open from disk)
Homepage at 390 / 430 / 768 / 1440; /shop/ and a product page at 390 / 1440.
"""
import sys
from playwright.sync_api import sync_playwright

arg = sys.argv[1] if len(sys.argv) > 1 else "8766"
BASE = "file:///Users/s/padel-azor/" if arg == "file" else f"http://localhost:{arg}/"
OUT = "/Users/s/padel-azor/screenshots/"
SIZES = {"mobile-390": (390, 844, True), "mobile-430": (430, 932, True), "tablet-768": (768, 1024, True), "desktop-1440": (1440, 900, False)}
PAGES = [("index.html", "home", ["mobile-390", "mobile-430", "tablet-768", "desktop-1440"]),
         ("shop/index.html", "shop", ["mobile-390", "desktop-1440"]),
         ("shop/product.html?id=metalbone-2026", "product", ["mobile-390", "desktop-1440"])]

with sync_playwright() as p:
    b = p.chromium.launch()
    for path, label, sizes in PAGES:
        for size in sizes:
            w, h, mobile = SIZES[size]
            ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile, locale="he-IL")
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            sep = "&" if "?" in path else "?"
            page.goto(f"{BASE}{path}{sep}shot={size}", wait_until="networkidle")
            page.wait_for_timeout(1000)
            page.evaluate("""async () => {
              document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible'));
              document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager');
              window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 700));
              window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
              const h = document.getElementById('site-header'); if (h && !h.hasAttribute('data-solid')) h.classList.remove('is-solid');
            }""")
            page.wait_for_timeout(500)
            name = f"{label}-{size}" if label != "home" else size
            page.screenshot(path=f"{OUT}{name}.png", full_page=True)
            m = page.evaluate("""() => ({ page: document.documentElement.scrollHeight, wide: document.documentElement.scrollWidth,
                                          cards: document.querySelectorAll('.product-card').length })""")
            print(name, m, "errors:" if errors else "ok", *errors)
            ctx.close()
    b.close()
