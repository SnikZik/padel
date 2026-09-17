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


## Live preview (GitHub Pages)

Repo: https://github.com/SnikZik/padel  ·  Preview: https://snikzik.github.io/padel/

`main` is the deployed branch (Pages source: root). Push to `main` and the preview updates within a minute.

**Before the real domain goes live, remove the search guards**: `robots.txt` (Disallow all) and the
`<meta name="robots" content="noindex, nofollow">` line in `index.html` and `shop/index.html`. They exist so the
preview URL is never indexed; `shop/product.html` keeps its own noindex on purpose.

Not in the repo (see `.gitignore`): `handoff/` (client package, large media), `screenshots/`, `*.zip`.
`tools/build_hero_video.py` and `tools/build_hero_image.py` need the local `handoff/` folder to re-render the media.

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

## Footer (Snir's footer DEV package, 2026-09-17)

Package in `handoff-extra/footer-dev-2026-09-17/`, built from `assets/footer-reference-desktop.png` (the preferred direction).
`python3 tools/sync_footer.py` renders the same footer into `index.html`, `shop/index.html` and `shop/product.html`
(only the asset base path and link targets differ); edit the template there, not the pages.

- Deep green section; the club photo (`assets/footer/footer-bg.webp`, the text-free top of the reference) sits at the top and
  fades into the green under the invitation, so it never reads as a separate image block.
- Invitation "הצטרפו לקהילת הפאדל של אזור", line "מגרשים, אנשים טובים ואווירה שמחברת.", CTAs הזמנת מגרש (booking) and דברו איתנו.
- Logo line: "יותר מפאדל. זו קהילה." with the white outline logo (`assets/brand/logo-outline-240/480.webp`, made from the original artwork).
- Tiles: address (Waze), phone, WhatsApp, Instagram, Facebook, TikTok (בקרוב, display only). Phone, WhatsApp, Facebook and
  "דברו איתנו" read `phone`, `whatsappUrl`, `facebookUrl`, `links.contact` in `site.config.js` and stay inert while null.
  No placeholder numbers are shown on the page; the config comments carry the example formats.
- Bottom bar: copyright, the same menu as the header, WELLNESS & SOCIAL. Phones: tiles 3 across, menu above the copyright.

## Small English labels removed (Snir, 2026-09-17)

THE PADEL CLUB AZOR, SHOP (homepage and /shop/), COMMUNITY, VISIT US and TOURNAMENTS are gone from every page, with their styles.
Section titles now open each block.

## Tournaments (Snir's DEV package, 2026-09-17)

Package kept in `handoff-extra/tournaments-dev-2026-09-17/` (mockups `final-mockups/01` desktop and `02` mobile, reference photos,
brand palette). Section `#tournaments` sits between the shop and the community block (Snir moved the shop above it);
the menu item "אירועים" points to it.

- Content lives in `data/tournaments.json` (`id, date, title, organizer, level, participants, pairs, prizes, crowd, image,
  registrationUrl, status`). `python3 tools/sync_tournaments.py` renders the filter chips, the cards and the schema.org
  `SportsEvent` list into `index.html` (plain HTML, works without JS). Values that were not supplied stay null and are not shown.
- Chips: הכל, קרוב (the next tournament from today on), and one chip per level in the data. Filtering is `assets/js/tournaments.js`.
- Phones (< 768px) show neither the chips nor the intro button (Snir): every card is listed. The button reads "טורנירים קרובים".
- "לפרטים והרשמה" is inert until a card gets `registrationUrl`; "טורנירים קרובים" and "להצטרפות לקהילה" wait for
  `links.tournamentsUpcoming` / `links.communityJoin` in `site.config.js`.
- Images in `assets/tournaments/`: the top banner is cut from the mockups themselves (desktop 1378x182, phone 700x163,
  inset past their rounded corners), so it is only as sharp as the mockup; replace it with full-size artwork when supplied.
  Card photos are square crops of the package's reference photos, clear of the Instagram carousel arrows and dots
  (1000 and 600 px). The community banner photo is the text-free top of `assets/shop/04-shop-bottom-mobile.webp`,
  with "A STRONGER PADEL COMMUNITY" set as live text.
- Layout: phones and tablets show horizontal cards (photo on the left), desktop three cards in a row; card header row and the
  one-row community banner from 1280px. Colours are the brand palette tokens only.

## Shop banners (approved artwork, 2026-09-17)

Four supplied files in `assets/shop/`, byte-identical to the package (kept in `handoff-extra/shop-banners-2026-09-17/`):
`01-shop-top-desktop.webp` 1920x520, `02-shop-top-mobile.webp` 1080x900, `03-shop-bottom-desktop.webp` 1920x360,
`04-shop-bottom-mobile.webp` 1080x520. Each banner is a `<picture>`: mobile file below 768px, desktop file from 768px.
Full width, no overlay, no filter, no text on top. Top banner: native aspect ratio, no crop. Bottom banner: Snir asked
for it thinner at full width (17.9), so it is trimmed top and bottom by CSS only (phones 1080x430 of 520, desktop
1920x250 of 360), with the window placed so the text and the ball's logo stay in frame. The files are untouched. Used on the homepage shop section and on
`/shop/`, top banner above the heading, bottom banner after the grid (the homepage no longer shows the bottom banner:
the tournaments banner follows the shop there, Snir 17.9). Paths are relative (the site lives under
`/padel/` on GitHub Pages), and the alt text uses a comma instead of the package's dash (no-dash rule).

## Shop ecosystem (approved retail reference, 2026-09-16)

Catalogue only: the club sells on its shop floor, so there is no cart, no checkout and no price anywhere.
Products show `זמין בחנות במתחם` with a green dot and a quiet `לפרטים` link.

- Palette: section `#F5F4F0`, image tile `#EEEEEB`, cards white with a 1px `#E2E2DD` border, radius 7, no shadow.
  Ink `#101410`, muted `#6E736E`, chips `#ECECE8` / `#555B56`. Brand green only for the active chip, CTA, availability dot and badges.
- Homepage `#shop`: `ציוד פאדל נבחר`, one-line subtitle, `לכל המוצרים` CTA, then 4 featured products (2x2 on phones).
- `shop/index.html`: compact banner built from a real club photo, heading block, category chips
  (הכל, מחבטים, נעליים, ביגוד, כדורים, תיקים, אביזרים), grid 4 / 3 / 2, then the `MORE THAN A GAME` strip.
- `shop/product.html?id=<id>`: gallery tile, meta table (brand, sku, category, attributes), availability, link to the
  manufacturer page. No cart control.
- One card component, `assets/js/products/card.js`. Card fields: category (Hebrew), product name (Latin, `dir="ltr"`),
  availability, CTA. Badges LIMITED / EXCLUSIVE / NEW come from `badge` in the catalogue; none is set on the real products.
- Product model (`data/products.json`, schema v2): `id, sku, brand, name, nameHe, category, images[], price,
  compareAtPrice, availability, badge, description, attributes, url, referenceUrl`. Ready to be replaced by the
  external inventory API through `InventoryApiSource`.

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
| `phone` | footer "טלפון" tile, schema `telephone` | null |
| `whatsappUrl` | footer "וואטסאפ" tile | null |
| `facebookUrl` | footer "פייסבוק" tile | null |
| `links.contact` | footer "דברו איתנו" | null |
| `openingHours` | schema `openingHours` | null |
| `links.aboutStory` | "הסיפור שלנו" | null → button inert |
| `links.shop` | "לחנות" | null → button inert |
| `links.communityEvents` | "אירועים וקהילה" | null → button inert |
| `links.tournamentsUpcoming` | "טורנירים קרובים" (tablet and desktop) | null → button inert |
| `links.communityJoin` | "להצטרפות לקהילה" (tournaments banner) | null → button inert |
| `shop.inventory` | product source | null → static catalogue |

"לפרטים" on a product card opens the manufacturer page (`referenceUrl`, new tab) until `url` (the club's own product page) is set,
same as `handoff/08_dev/reference.html`.

## Hero media (Snir, 2026-09-17, fourth revision)

- **Phones (< 768px): the club's walkthrough reel**, unchanged (`hero_mobile.mp4` 576x1024, poster `hero_mobile.webp`
  = its first frame). Rebuild with `tools/build_hero_video_mobile.py "<path to WhatsApp Video 2026-09-10 at 11.23.59 (1).mp4>"`.
- **Tablet and desktop (>= 768px): the locked-off tripod shot Snir supplied** (original in
  `handoff-extra/hero-video-source-2026-09-17.mp4`). `tools/build_hero_video.py` renders `hero_desktop.mp4`
  (1920x1080) and its first-frame poster `hero_desktop.webp`, with the first second dissolved into the end for a
  seamless loop. It never touches the phone files.
- No zoom, no pan, no CSS motion on either. Reduced motion or data saver: poster only.
- The static desktop image from 17.9 morning is kept in `handoff-extra/hero-desktop-source-2026-09-17.png`.

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
