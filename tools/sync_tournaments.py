#!/usr/bin/env python3
"""Render the events banner, the tournaments filter chips, the cards and the schema.org events from
data/tournaments.json into index.html, between the events-banner, tournaments-filters and tournaments-cards markers,
so the section is plain HTML (readable without JS, indexable) while the content stays data-driven.
assets/js/tournaments.js only filters the rendered cards and re-checks the banner's date on load.

Card fields: id, date (ISO), title ({Latin} runs become isolated LTR spans), organizer {type, name}, level,
participants, pairs, prizes, crowd, image {src, small, alt, position, positionPhone}, registrationUrl, status.
Missing values are simply not shown. A null registrationUrl keeps "לפרטים והרשמה" as designed but inert. A tournament whose date has passed is marked
"הסתיים" by assets/js/tournaments.js (the date decides, not the file), and the "הסתיימו" chip lists those.

usage: python3 tools/sync_tournaments.py
"""
import html
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "index.html"
EVENT_PAGE = ROOT / "tournament/index.html"   # the landing page shows the same photos, one level down
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

def gallery_data(t):
    """The club's own photos of a finished tournament, read by assets/js/gallery.js when the card is clicked."""
    if not t.get("gallery"):
        return ""
    payload = json.dumps(t["gallery"], ensure_ascii=False).replace("<", "\\u003c")
    return f'          <script type="application/json" class="tournament-gallery">{payload}</script>\n'

def card(t):
    d = date.fromisoformat(t["date"])
    img = t["image"]
    title_id = f't-{t["id"]}'
    if t.get("registrationUrl"):
        url = t["registrationUrl"]
        # a page of our own opens in the same tab; anything on another site opens in a new one
        away = ' target="_blank" rel="noopener"' if url.startswith("http") else ""
        cta = f'<a class="btn tournament-cta" href="{html.escape(url)}"{away}>לפרטים והרשמה</a>'
    else:
        cta = '<a class="btn tournament-cta" aria-disabled="true">לפרטים והרשמה</a>'
    style = f'--pos: {img.get("position", "50% 50%")}; --pos-phone: {img.get("positionPhone", img.get("position", "50% 50%"))}'
    return f'''      <li class="tournament-card" data-level="{html.escape(t["level"])}" data-date="{t["date"]}"{' data-gallery="' + str(len(t["gallery"])) + '"' if t.get("gallery") else ""}>
        <article aria-labelledby="{title_id}">
          <div class="tournament-media" style="{style}">
            <img src="{img["src"]}" srcset="{img["small"]} 600w, {img["src"]} 1000w" sizes="(min-width: 1024px) 30vw, 50vw"
                 width="{img.get("width", 1000)}" height="{img.get("height", 1000)}" alt="{html.escape(img["alt"])}" loading="lazy" decoding="async">
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
{gallery_data(t)}        </article>
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

chips = ([("all", "הכל", True), ("upcoming", "קרוב", False)]
         + [(f"level:{lv}", f"רמה {latin(lv)}", False) for lv in levels]
         + [("past", "הסתיימו", False)])
filters = "<!-- tournaments-filters:start / generated from data/tournaments.json by tools/sync_tournaments.py -->\n"
filters += '      <div class="tournaments-filters" role="group" aria-label="סינון טורנירים">\n'
filters += "\n".join(f'        <button class="tournaments-chip" type="button" data-filter="{f}" aria-pressed="{str(on).lower()}">{label}</button>'
                     for f, label, on in chips) + "\n"
filters += "      </div>\n      <!-- tournaments-filters:end -->"

cards = "<!-- tournaments-cards:start / generated from data/tournaments.json by tools/sync_tournaments.py, do not edit by hand -->\n"
cards += '    <ul class="tournaments-grid" id="tournaments-grid">\n'
cards += "\n".join(card(t) for t in items) + "\n"
cards += '      <li class="tournaments-empty" hidden></li>\n'
cards += "    </ul>\n"
cards += '    <script type="application/ld+json" id="schema-tournaments">\n' + schema(items) + "\n    </script>\n"
cards += "    <!-- tournaments-cards:end -->"

# the banner under the hero (Snir, 5.10.2026): the next event from today on, or the section itself when none is left
MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]
nxt = next((t for t in items if date.fromisoformat(t["date"]) >= date.today()), None)
last = next((t for t in reversed(items) if date.fromisoformat(t["date"]) < date.today()), None)
trophy = icon("trophy").replace('class="tournament-icon"', 'class="events-banner-glyph"')
shown = nxt or last
if shown:
    d = date.fromisoformat(shown["date"])
    label, title = ("האירוע הקרוב" if nxt else "הטורניר האחרון"), rich(shown["title"])
    when = f'<time class="events-banner-time" datetime="{shown["date"]}">{d.day} ב{MONTHS[d.month - 1]}</time>'
    stamp = shown["date"] if nxt else ""
else:
    label, title, when, stamp = "אירועים במועדון", "טורנירים במועדון", "", ""

banner = "<!-- events-banner:start / generated from data/tournaments.json by tools/sync_tournaments.py, do not edit by hand -->\n"
# an upcoming event with a page of its own gets the click; otherwise the banner leads to the section
target = shown.get("registrationUrl") if (nxt and shown and shown.get("registrationUrl")) else "#tournaments"
banner_cta = "לפרטים והרשמה" if target != "#tournaments" else "לכל האירועים"
banner += f'''  <aside class="events-banner" data-date="{stamp}" aria-label="אירועים במועדון">
    <a class="events-banner-link" href="{target}">
      <span class="events-banner-icon" aria-hidden="true">{trophy}</span>
      <span class="events-banner-copy">
        <span class="events-banner-label">{label}</span>
        <span class="events-banner-title">{title}</span>
      </span>
      {when}
      <span class="events-banner-cta">{banner_cta}</span>
    </a>
  </aside>''' + "\n"
banner += "  <!-- events-banner:end -->"

# the landing page's photo strip: the newest tournament that has photos, six thumbs and the whole set as JSON
shots = next((t for t in reversed(items) if t.get("gallery")), None)
if EVENT_PAGE.exists() and shots:
    photos = shots["gallery"]
    thumbs = "\n".join(
        f'''        <li><button class="ev-shot" type="button" data-index="{i}" aria-label="פתיחת גלריית התמונות">
          <picture><source type="image/webp" srcset="../{g["webp"]}"><img src="../{g["src"]}" width="{g["width"]}" height="{g["height"]}" alt="{html.escape(g["alt"])}" loading="lazy" decoding="async"></picture>
        </button></li>''' for i, g in enumerate(photos[:6]))
    payload = json.dumps(photos, ensure_ascii=False).replace("<", "\\u003c")
    strip = "<!-- event-gallery:start / generated from data/tournaments.json by tools/sync_tournaments.py, do not edit by hand -->\n"
    strip += f'''    <div data-event-gallery>
      <ul class="ev-shots">
{thumbs}
      </ul>
      <button class="btn btn-ghost-green ev-shots-more" type="button">לכל התמונות</button>
      <script type="application/json">{payload}</script>
    </div>''' + "\n"
    strip += "    <!-- event-gallery:end -->"
    event_page = replace_block(EVENT_PAGE.read_text(encoding="utf-8"), "event-gallery", strip)
    EVENT_PAGE.write_text(event_page, encoding="utf-8")
    print(f"tournament/index.html: {len(photos)} photos in the strip")

page = PAGE.read_text(encoding="utf-8")
page = replace_block(page, "events-banner", banner)
page = replace_block(page, "tournaments-filters", filters)
page = replace_block(page, "tournaments-cards", cards)
PAGE.write_text(page, encoding="utf-8")
print(f"rendered {len(items)} tournaments, {len(chips)} filter chips and the events banner ({label}) into index.html")
