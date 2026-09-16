/**
 * Product repository: the only door between the UI and product data.
 *
 * A "source" is anything with `async list()` returning the raw catalogue
 * ({ products: [...] } or a bare array). The repository tries its sources in
 * order and normalizes whatever it gets into the Product model below, so the
 * cards never know where data came from. The future third-party inventory
 * system (or WooCommerce) is one more source; nothing in the UI changes.
 *
 * Product model (every field always present after normalize):
 *   id, sku, name, nameEn, category, categoryLabel (singular), accent, badge,
 *   images: [{ src, webp, width, height, alt }],
 *   price: number|null, compareAtPrice: number|null, currency,
 *   stock: number|null, limitedEdition: boolean,
 *   url: string|null (club product page override), referenceUrl: string|null (manufacturer page),
 *   description: string|null
 *
 * Classic script (no ES modules) so the site also runs when opened straight from disk.
 * Exposes window.PadelShop. Paths in the catalogue are relative to the site root; pages
 * deeper in the tree set window.PADEL_BASE (e.g. "../") and the renderers prefix it.
 */
(function (global) {
  "use strict";

  /** Retail categories, in the order the catalogue navigation shows them. */
  const CATEGORIES = [
    { id: "racket",    label: "מחבטים", single: "מחבט" },
    { id: "balls",     label: "כדורים", single: "כדורים" },
    { id: "apparel",   label: "ביגוד",  single: "ביגוד" },
    { id: "shoes",     label: "נעליים", single: "נעליים" },
    { id: "bag",       label: "תיקים",  single: "תיק" },
    { id: "accessory", label: "אביזרים", single: "אביזר" }
  ];
  const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const BADGES = ["LIMITED", "EXCLUSIVE", "NEW"];

  /** Reads the catalogue embedded in the page (<script type="application/json" id="product-data">). */
  class InlineJsonSource {
    constructor(selector = "#product-data") { this.selector = selector; }
    async list() {
      const el = document.querySelector(this.selector);
      if (!el || !el.textContent.trim()) return null;
      return JSON.parse(el.textContent);
    }
  }

  /** Fetches data/products.json (needs http; declines silently on file://). */
  class FetchJsonSource {
    constructor(url = "data/products.json") { this.url = url; }
    async list() {
      if (location.protocol === "file:") return null;
      const res = await fetch(this.url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`products: ${this.url} responded ${res.status}`);
      return res.json();
    }
  }

  /**
   * Placeholder for the third-party inventory / WooCommerce connector.
   * Implement `list()` to call the provider, then map its payload to the Product model.
   * Until `config.inventory.endpoint` is set this source declines and the static catalogue is used.
   */
  class InventoryApiSource {
    constructor(config = {}) { this.config = config; }
    async list() {
      if (!this.config.endpoint) return null;
      throw new Error("InventoryApiSource: connector not implemented yet (TODO)");
    }
  }

  class ProductRepository {
    constructor(sources, { currency = "ILS" } = {}) {
      this.sources = sources;
      this.currency = currency;
    }

    async list() {
      for (const source of this.sources) {
        try {
          const raw = await source.list();
          if (!raw) continue;
          const items = Array.isArray(raw) ? raw : raw.products || [];
          const currency = (!Array.isArray(raw) && raw.currency) || this.currency;
          return items.map((p) => normalize(p, currency));
        } catch (err) {
          console.warn(`[products] ${source.constructor.name} failed:`, err.message);
        }
      }
      return [];
    }

    async get(id) {
      const all = await this.list();
      return all.find((p) => p.id === id) || null;
    }
  }

  function toNumberOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalize(raw, currency = "ILS") {
    const category = raw.category || raw.type || "accessory";
    const cat = CATEGORY_BY_ID[category] || { id: category, label: category, single: category };
    const images = (raw.images && raw.images.length ? raw.images : [{ src: raw.image || raw.image_url }])
      .filter((img) => img && img.src)
      .map((img) => ({
        src: img.src,
        webp: img.webp || null,
        width: img.width || null,
        height: img.height || null,
        alt: img.alt || raw.name || raw.name_he || ""
      }));
    const limited = Boolean(raw.limitedEdition ?? raw.limited_edition);
    let badge = raw.badge ? String(raw.badge).toUpperCase() : (limited ? "LIMITED" : null);
    if (badge && !BADGES.includes(badge)) badge = null;

    return {
      id: String(raw.id || raw.sku || raw.product_code || ""),
      sku: raw.sku || raw.product_code || null,
      name: raw.name || raw.name_he || "",
      nameEn: raw.nameEn || raw.name_en || "",
      category: cat.id,
      categoryLabel: cat.single,
      accent: raw.accent || null,
      badge,
      images,
      price: toNumberOrNull(raw.price),
      compareAtPrice: toNumberOrNull(raw.compareAtPrice ?? raw.compare_at_price),
      currency: raw.currency || currency,
      stock: toNumberOrNull(raw.stock),
      limitedEdition: limited,
      url: raw.url || null,
      referenceUrl: raw.referenceUrl || raw.source_product_url || null,
      description: raw.description || null
    };
  }

  /** Base path of the current page relative to the site root ("" on the homepage, "../" in /shop/). */
  function base() { return global.PADEL_BASE || ""; }

  function formatPrice(amount, currency) {
    try {
      return new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  global.PadelShop = Object.assign(global.PadelShop || {}, {
    CATEGORIES, CATEGORY_BY_ID, BADGES, InlineJsonSource, FetchJsonSource, InventoryApiSource, ProductRepository,
    normalize, base, formatPrice
  });
})(window);
