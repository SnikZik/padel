# The Padel Club Azor: website

Implementation of the locked handoff in `handoff/` (`CLAUDE_PROMPT.txt`, `08_dev/DEVELOPER_SPEC.md`,
`01_reference/approved_mockup_desktop_mobile.png`). Static, mobile-first, no build step.

## Run

Double-click `index.html`: it works straight from disk (classic scripts, catalogue embedded in the page).
Or serve it:

```bash
python3 -m http.server 8766 --directory /Users/s/padel-azor
```

After editing `data/products.json`, run `python3 tools/sync_products.py` to refresh the embedded catalogue.

## Structure

```
index.html                 the page, section order exactly as the spec (header → hero → features → about → gallery → shop → community → visit → footer)
site.config.js             runtime config + every TODO value (see below)
assets/css/style.css       tokens from handoff/08_dev/design-tokens.json, mobile first, breakpoints 768 / 1024
assets/js/main.js          header, drawer, hero video, reveals, scroll spy, product rendering, schema patch
assets/js/products/        repository.js = product data layer (sources + normalize), card.js = card renderer
data/products.json         launch catalogue (4 verified adidas products), prices/stock null on purpose
assets/img                 supplied venue WebPs, unchanged
assets/video               supplied MP4s (real photos only)
assets/brand               logo_circle_transparent.png resized to 160 / 320 / 512
assets/products            product images downloaded from the verified adidas URLs (jpg + webp), served locally
assets/icons               supplied SVGs (inlined in the page for currentColor)
tools/build_artifact.py    builds the Claude Artifact review copy
handoff/                   the untouched handoff package (source of truth)
```

## Below the hero (2026-09-15, later)

The 4-icon feature strip is gone (icons, dividers, labels). In its place: one floating booking card (`.book-card`)
that overlaps the hero by 30px on desktop / 22px on phones: white, radius 16/14, soft shadow, headline + three venue
highlights in one row (4 מגרשי פאדל · מתחם מקורה · קפיטריה במקום; short form 4 מגרשים · מקורה · קפיטריה on phones)
+ green pill to Lazuz. 900px max / 86px on desktop, `calc(100% - 24px)` on phones. No physiotherapy mention here. About starts 36px (desktop) / 28px (phone)
after the card. `main` is white so nothing reads as a band beside the card. The feature copy is not used anywhere else.

## Cream surfaces + centred phone blocks (2026-09-16)

Page surfaces are cream `--cream: #FBF8F3` (About, gallery, community, visit, /shop/, solid header); the homepage shop
zone is one step deeper, `--stone: #F3EFE8`, so it still reads as its own retail area. Cards and the booking card stay white.
On phones (< 768px) the About copy, shop intro, Visit block and footer legal lines are centred; desktop unchanged.

**adidas mark**: `assets/brand/adidas-mark.svg` (also inline in the shop intro) is a placeholder drawn to the standard
three-bar proportions. Replace it with the official asset from the club's adidas dealer kit before launch.

## Shop ecosystem (retail pass, 2026-09-15)

- Homepage `#shop` = featured products: stone section (#F5F3EE), 320px green intro panel + row of four (≥1280px),
  stacked below that, 2 per row on phones with a full-width "לכל המוצרים" after the grid.
- `shop/index.html` = catalogue: heading block, category nav (מחבטים, כדורים, ביגוד, נעליים, תיקים, אביזרים),
  sort select, count, 4 / 3 / 2 columns. `shop/product.html?id=<id>` = product page (gallery tile, meta, "הוסף לסל"
  inert until `shop.checkoutEnabled`, link to the manufacturer page).
- One card component (`assets/js/products/card.js`) on every page: tile #EAEEEF (= the adidas photography background,
  so products float with no inner square), category, name (3-line clamp), optional price, quiet "לפרטים".
  Badges LIMITED / EXCLUSIVE / NEW via `badge` or `limitedEdition` in the catalogue (none set on the real products).
- Pages under `/shop/` set `window.PADEL_BASE = "../"`; renderers prefix catalogue paths with it. Works from disk.
- WordPress later: cards map to a `product` CPT / WooCommerce loop; catalogue nav = product categories; the same CSS applies.

## Shop data layer

`ProductRepository` tries sources in order: `InventoryApiSource` (future connector, declines until
`shop.inventory.endpoint` is set) → `InlineJsonSource` (`#product-data` embed, used by the artifact build)
→ `FetchJsonSource` (`data/products.json`). Every source is normalized to one Product model
(`id, sku, name, nameEn, category, images[], price, compareAtPrice, currency, stock, limitedEdition, url, referenceUrl`).
Cards render price/stock only when `shop.showPrices` / `shop.showStock` are on AND the value is not null.
To connect the inventory system: implement `InventoryApiSource.list()` and map its payload; nothing else changes.

## TODO: values missing from the handoff (site.config.js)

| Key | Used by | Now |
|---|---|---|
| `siteUrl` | canonical, absolute og:image, schema `url` | null |
| `bookingUrl` | all "הזמנת מגרש" buttons | Lazuz homepage from content-he.json (no club deep link supplied) |
| `phone` | schema `telephone` | null |
| `openingHours` | schema `openingHours` | null |
| `links.aboutStory` | "הסיפור שלנו" | null → button inert |
| `links.shop` | "לחנות" | null → button inert |
| `links.communityEvents` | "אירועים וקהילה" | null → button inert |
| `links.eventsMenu` | menu item "אירועים" | `#community` (no events section exists) |
| `shop.inventory` | product source | null → static catalogue |

"לפרטים" on a product card opens the manufacturer page (`referenceUrl`, new tab) until `url` (the club's own product page) is set,
same as `handoff/08_dev/reference.html`.

## Hero media (Snir, 2026-09-15, third revision)

- **Phones (< 768px): the club's real walkthrough reel** (`WhatsApp Video 2026-09-10 at 11.23.59 (1).mp4`, 576×1024).
  `tools/build_hero_video.py` cuts the pink-court passage (pink court box → pink net → bench → court "3" → turf),
  then the lounge with the logo wall, then dissolves into a still of the opening frame so the loop is seamless. Light
  deshake (16px window) only; no zoom, no pan, no CSS motion. Poster `hero_mobile.webp` = the exact first frame.
  Output stays at the reel's resolution (no fake upscale), 10.3 s, ~2.9 MB, H.264 4:2:0.
- **Tablet and desktop (≥ 768px): static image only.** `tools/build_hero_image.py` builds `hero_desktop.webp` from the
  real aerial photo `court_03.jpg`: composed crop (pink courts as the hero, planter/cones/far right dropped), +6% contrast,
  +10% colour, unsharp, soft vignette. No retouching, no generated content. The JS never loads a video at this width.
- Overlays: phone = vertical gradient (light top, firmer under the copy); desktop = left-to-right gradient behind the copy.
- The supplied MP4s stay untouched in `handoff/04_video` (they are H.264 4:4:4, which iPhones do not decode).
- `community_real_placeholder.webp` uses court_01 so the wide shot is not repeated.

## Visual polish pass (Snir, 2026-09-15)

Structure, section order and content unchanged. Only finish: one type scale (headings 600, hero 700, sizes −12-15%),
one spacing rhythm (sections 48-80px desktop, inner 16-28px), hairline dividers instead of borders, inset photos with
12px radius, gaps between image and copy on desktop, shop on paper with a rounded green intro panel (CTA now `btn-primary`),
refined product cards, calmer footer. Hero opens on a 4s static wide shot (no zoom). English strings carry `dir="ltr"`
and every copy block declares an explicit text-align edge (Chromium has no `text-align: match-parent`).
`tools/screenshots.py` captures 390 / 430 / 820 / 1440 into `screenshots/`.

## Final polish (Snir, 2026-09-15, later)

Section titles 500, feature/product headings 500, hero stays 700. Feature dividers are short faint pseudo-elements
(no cell borders, no section border). Gallery desktop gap 20px, radius 12px everywhere. Shop panel lighter (title 500,
38px) and the "לחנות" pill sits inside the panel's foot on desktop (panel reserves 128px, CTA pulled up 96px), below the
products on phones. Product image box 3:4 phone / 10:11 desktop, titles 12.5-13px, hover = shadow only. Split gap
32-56px, visit 36/76px, footer phone 64/40px padding with 80px logo and 14px text. No transforms anywhere in the hero.

## Decisions that were not fully specified

- Header is transparent over the hero (as in the mockup) and turns white once the page scrolls, so it stays legible while sticky.
- Desktop copy blocks align to the outer page edge of their column: about / shop / visit left, community right
  (the mockup anchors eyebrows and CTAs to the outer edge; `reference.css` uses the same rule).
- `#courts` (menu "מגרשים") points at the real-photo gallery, not at the feature grid.
- Mobile community block: copy over the real venue photo with a green gradient, matching the mobile mockup; the crowd photo was not used.
- Hero video source is chosen in JS by viewport (`<source media>` is not honoured by every browser); reduced-motion or Save-Data → poster only.
- Meta description is the spec's suggested text as supplied (about 110 characters).

## Next step

WordPress theme (ACF + Yoast) built from this markup: every content block above maps to an ACF field group,
`data/products.json` maps to a `product` CPT, `site.config.js` maps to an ACF options page.
