#!/usr/bin/env python3
"""Move the site from the GitHub Pages preview URL to its own domain.

Everything that has to change when the domain arrives, in one run:

  1. CNAME for GitHub Pages (the apex domain),
  2. the "noindex" meta tag comes out of the public pages (the private ones keep it),
  3. canonical and og:url on every public page, and og:image as an absolute URL,
  4. the schema.org blocks get absolute image and url values,
  5. robots.txt opens the site and points at the sitemap,
  6. sitemap.xml with the public pages,
  7. siteUrl in site.config.js.

The two tournament pages hold the same event, so only the one named by --canonical-event
is indexable; the other keeps noindex and points its canonical at it.

usage:
    python3 tools/go_live.py example.co.il            # apply
    python3 tools/go_live.py example.co.il --dry-run  # show what would change
    python3 tools/go_live.py example.co.il --canonical-event tournament-v2
"""
import argparse
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# page -> (url path, in the sitemap?)
PUBLIC = {
    "index.html": ("/", True),
    "shop/index.html": ("/shop/", True),
    "shop/product.html": ("/shop/product.html", False),   # a template filled from the query string
    "tournament/index.html": ("/tournament/", True),
    "tournament-v2/index.html": ("/tournament-v2/", True),
}
PRIVATE = ["hero-test.html"]          # keeps noindex, never in the sitemap

NOINDEX = re.compile(r'[ \t]*<!-- preview only:[^\n]*\n[ \t]*<meta name="robots" content="noindex, nofollow">\n')
CANONICAL = re.compile(r'[ \t]*<link rel="canonical"[^>]*>\n')
OG_URL = re.compile(r'[ \t]*<meta property="og:url"[^>]*>\n')

def absolute(site, path):
    return site.rstrip("/") + path

def patch_page(rel, site, canonical_event, dry):
    page = ROOT / rel
    if not page.exists():
        return f"{rel}: missing, skipped"
    text = page.read_text(encoding="utf-8")
    before = text
    url_path, _ = PUBLIC[rel]
    url = absolute(site, url_path)

    # the duplicate event page stays out of the index and points at the chosen one
    other_event = rel.startswith("tournament") and not rel.startswith(f"{canonical_event}/")
    if other_event:
        canonical_url = absolute(site, PUBLIC[f"{canonical_event}/index.html"][0])
    else:
        canonical_url = url
        text = NOINDEX.sub("", text)

    text = CANONICAL.sub("", text)
    text = OG_URL.sub("", text)
    head_anchor = '<meta name="theme-color"'
    assert head_anchor in text, f"{rel}: no theme-color meta to anchor on"
    insert = (f'<link rel="canonical" href="{canonical_url}">\n'
              f'<meta property="og:url" content="{url}">\n')
    text = text.replace(head_anchor, insert + head_anchor, 1)

    # og:image and the schema images point at the domain, relative paths break when shared
    def fix_asset(m):
        value = m.group(2)
        if value.startswith(("http://", "https://")):
            return m.group(0)
        clean = value.lstrip("./").lstrip("/")
        while clean.startswith("../"):
            clean = clean[3:]
        return f'{m.group(1)}{absolute(site, "/" + clean)}{m.group(3)}'

    text = re.sub(r'(<meta property="og:image" content=")([^"]+)(">)', fix_asset, text)
    text = re.sub(r'("image": \["?)([^"\]]+)', lambda m: m.group(1) + absolute(site, "/" + m.group(2).lstrip("./")), text)

    if dry:
        return f"{rel}: {'canonical to the other event page' if other_event else 'public'}" + ("" if text != before else ", no change")
    page.write_text(text, encoding="utf-8")
    return f"{rel}: {'noindex kept, canonical to the chosen event page' if other_event else 'open to search'}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("domain", help="the apex domain, e.g. example.co.il")
    ap.add_argument("--canonical-event", default="tournament", choices=["tournament", "tournament-v2"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    domain = args.domain.strip().lower().removeprefix("https://").removeprefix("http://").strip("/")
    site = f"https://{domain}"
    out = []

    for rel in PUBLIC:
        out.append(patch_page(rel, site, args.canonical_event, args.dry_run))
    for rel in PRIVATE:
        out.append(f"{rel}: left as it is, noindex")

    cname = f"{domain}\n"
    robots = ("User-agent: *\n"
              "Allow: /\n\n"
              f"Sitemap: {site}/sitemap.xml\n")
    today = date.today().isoformat()
    urls = "\n".join(f"  <url>\n    <loc>{absolute(site, path)}</loc>\n    <lastmod>{today}</lastmod>\n  </url>"
                     for rel, (path, in_map) in PUBLIC.items()
                     if in_map and (ROOT / rel).exists()
                     and not (rel.startswith("tournament") and not rel.startswith(f"{args.canonical_event}/")))
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n")

    config = (ROOT / "site.config.js").read_text(encoding="utf-8")
    config_new = re.sub(r'siteUrl: [^,]+,[^\n]*', f'siteUrl: "{site}",', config, count=1)

    if args.dry_run:
        print("\n".join(out))
        print(f"\nCNAME -> {domain}\nrobots.txt -> opens the site\nsitemap.xml -> {urls.count('<loc>')} pages\n"
              f"site.config.js -> siteUrl {site}")
        return

    (ROOT / "CNAME").write_text(cname, encoding="utf-8")
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    (ROOT / "site.config.js").write_text(config_new, encoding="utf-8")
    print("\n".join(out))
    print(f"CNAME, robots.txt, sitemap.xml ({urls.count('<loc>')} pages) and site.config.js written for {site}")
    print("next: set the custom domain in the repository's Pages settings and switch Enforce HTTPS on")

if __name__ == "__main__":
    main()
