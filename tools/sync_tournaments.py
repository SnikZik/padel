#!/usr/bin/env python3
"""Render the tournaments filter chips, cards and schema.org events from data/tournaments.json into index.html,
between the tournaments-filters and tournaments-cards markers, so the section is plain HTML (readable without JS,
indexable) while the content stays data-driven. assets/js/tournaments.js only filters the rendered cards.

Card fields: id, date (ISO), title ({Latin} runs become isolated LTR spans), organizer {type, name}, level,
participants, pairs, prizes, crowd, image {src, small, alt, position, positionPhone}, registrationUrl, status.
Missing values are simply not shown. A null registrationUrl keeps "לפרטים והרשמה" as designed but inert.

usage: python3 tools/sync_tournaments.py
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
ADDRESS = {"@type": "PostalAddress", "streetAddress": "ז׳בוטינסקי 28", "addressLocality": "אזור", "addressCountry": "IL"}

def latin(text):
    return f'<span class="latin" dir="ltr" lang="en">{html.escape(text)}</span>'

def rich(text):
    """Escape, then turn {Latin} runs into isolated LTR spans."""
    out, pos = [], 0
    for m in re.finditer(r"\{([^}]+)\}", text):
        out.append(html.escape(text[pos:m.start()]))
        out.append(latin(m.group(1)))
        pos = m.end()
    out.append(html.escape(text[pos:]))
    return "".join(out)

def plain(text):
    return re.sub(r"[{}]", "", text)

def icon(name):
    svg = (ROOT / f"assets/icons/{name}.svg").read_text(encoding="utf-8").strip()
    svg = svg.replace('xmlns="http://www.w3.org/2000/svg" ', "")
    svg = re.sub(r"\s*\n\s*", "", svg)
    return svg.replace("<svg ", '<svg class="tournament-icon" aria-hidden="true" focusable="false" ', 1)

def details(t):
    rows = []
    if t.get("participants") or t.get("pairs"):
        parts = []
        if t.get("participants"): parts.append(f'{t["participants"]} משתתפים')
        if t.get("pairs"): parts.append(f'{t["pairs"]} זוגות')
        rows.append((icon("users"), " / ".join(parts)))
    if t.get("prizes"):
        rows.append((icon("trophy"), html.escape(t["prizes"])))
    if t.get("crowd"):
        rows.append((icon("users"), f'<bdi dir="ltr">{html.escape(t["crowd"])}</bdi> קהל'))
    return "\n".join(f'              <li>{svg}<span>{text}</span></li>' for svg, text in rows)

def card(t):
    d = date.fromisoformat(t["date"])
    img = t["image"]
    title_id = f't-{t["id"]}'
    if t.get("registrationUrl"):
        cta = f'<a class="btn tournament-cta" href="{html.escape(t["registrationUrl"])}" target="_blank" rel="noopener">לפרטים והרשמה</a>'
    else:
        cta = '<a class="btn tournament-cta" aria-disabled="true">לפרטים והרשמה</a>'
    style = f'--pos: {img.get("position", "50% 50%")}; --pos-phone: {img.get("positionPhone", img.get("position", "50% 50%"))}'
    return f'''      <li class="tournament-card" data-level="{html.escape(t["level"])}" data-date="{t["date"]}">
        <article aria-labelledby="{title_id}">
          <div class="tournament-media" style="{style}">
            <img src="{img["src"]}" srcset="{img["small"]} 600w, {img["src"]} 1000w" sizes="(min-width: 1024px) 30vw, 50vw"
                 width="1000" height="1000" alt="{html.escape(img["alt"])}" loading="lazy" decoding="async">
            <p class="tournament-date"><time datetime="{t["date"]}" dir="ltr"><b>{d:%d/%m}</b><span>{d:%Y}</span></time></p>
            <p class="tournament-level"><span>רמה {latin(t["level"])}</span><span class="tournament-level-letter" aria-hidden="true">{html.escape(t["level"])}</span></p>
          </div>
          <div class="tournament-body">
            <div class="tournament-head">
              <h3 class="tournament-title" id="{title_id}">{rich(t["title"])}</h3>
            </div>
            <ul class="tournament-details">
{details(t)}
            </ul>
            {cta}
          </div>
        </article>
      </li>'''

def schema(items):
    out = []
    for t in items:
        item = {
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            "name": plain(t["title"]),
            "startDate": t["date"],
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "sport": "Padel",
            "location": {"@type": "Place", "name": "The Padel Club Azor", "address": ADDRESS},
            "organizer": {"@type": t["organizer"]["type"], "name": t["organizer"]["name"]},
            "image": [t["image"]["src"]],
        }
        if t.get("registrationUrl"):
            item["url"] = t["registrationUrl"]
        out.append(item)
    return json.dumps(out, ensure_ascii=False, indent=2).replace("<", "\\u003c")

def replace_block(page, name, block):
    new, n = re.subn(rf"<!-- {name}:start.*?<!-- {name}:end -->", block, page, flags=re.S)
    if n != 1:
        raise SystemExit(f"index.html: {name}:start / {name}:end markers not found exactly once")
    return new

data = json.loads((ROOT / "data/tournaments.json").read_text(encoding="utf-8"))
items = sorted(data["tournaments"], key=lambda t: t["date"])
levels = sorted({t["level"] for t in items})

chips = [("all", "הכל", True), ("upcoming", "קרוב", False)] + [(f"level:{lv}", f"רמה {latin(lv)}", False) for lv in levels]
filters = "<!-- tournaments-filters:start / generated from data/tournaments.json by tools/sync_tournaments.py -->\n"
filters += '      <div class="tournaments-filters" role="group" aria-label="סינון טורנירים">\n'
filters += "\n".join(f'        <button class="tournaments-chip" type="button" data-filter="{f}" aria-pressed="{str(on).lower()}">{label}</button>'
                     for f, label, on in chips) + "\n"
filters += "      </div>\n      <!-- tournaments-filters:end -->"

cards = "<!-- tournaments-cards:start / generated from data/tournaments.json by tools/sync_tournaments.py, do not edit by hand -->\n"
cards += '    <ul class="tournaments-grid" id="tournaments-grid">\n'
cards += "\n".join(card(t) for t in items) + "\n"
cards += '      <li class="tournaments-empty" hidden>אין כרגע טורניר קרוב.</li>\n'
cards += "    </ul>\n"
cards += '    <script type="application/ld+json" id="schema-tournaments">\n' + schema(items) + "\n    </script>\n"
cards += "    <!-- tournaments-cards:end -->"

page = PAGE.read_text(encoding="utf-8")
page = replace_block(page, "tournaments-filters", filters)
page = replace_block(page, "tournaments-cards", cards)
PAGE.write_text(page, encoding="utf-8")
print(f"rendered {len(items)} tournaments, {len(chips)} filter chips into index.html")
