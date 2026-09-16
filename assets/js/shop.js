/* /shop/ catalogue page and product page. Classic script, loads after site.config.js,
   products/repository.js and products/card.js. Data comes through ProductRepository only. */
(function () {
"use strict";

const { CATEGORIES, ProductRepository, InlineJsonSource, FetchJsonSource, InventoryApiSource, renderProductCard,
        productPicture, base, formatPrice } = window.PadelShop;
const config = window.PADEL_CONFIG || {};
const shopConfig = config.shop || {};
const repo = new ProductRepository([
  new InventoryApiSource(shopConfig.inventory || {}),
  new InlineJsonSource(),
  new FetchJsonSource(base() + "data/products.json")
]);
const cardOptions = { showPrices: Boolean(shopConfig.showPrices), showStock: Boolean(shopConfig.showStock) };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- catalogue ---------- */
const grid = document.getElementById("shop-grid");
if (grid) {
  const nav = document.getElementById("shop-nav");
  const sort = document.getElementById("shop-sort");
  const count = document.getElementById("shop-count");
  let products = [];
  let category = (location.hash.match(/cat=([a-z]+)/) || [])[1] || "all";

  function render() {
    let list = products.filter((p) => category === "all" || p.category === category);
    const mode = sort ? sort.value : "featured";
    if (mode === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "he"));
    if (mode === "price-asc") list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (mode === "price-desc") list = [...list].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));

    grid.replaceChildren();
    if (!list.length) {
      grid.appendChild(el("li", "shop-empty", "אין מוצרים בקטגוריה הזו כרגע."));
    } else {
      list.forEach((p) => grid.appendChild(renderProductCard(p, cardOptions)));
    }
    if (count) count.textContent = list.length === 1 ? "מוצר אחד" : `${list.length} מוצרים`;
    grid.setAttribute("aria-busy", "false");
  }

  function buildNav() {
    const items = [{ id: "all", label: "הכל" }, ...CATEGORIES];
    nav.replaceChildren();
    items.forEach((c) => {
      const b = el("button", "shop-nav-item", c.label);
      b.type = "button";
      b.dataset.category = c.id;
      b.setAttribute("aria-pressed", String(c.id === category));
      b.addEventListener("click", () => {
        category = c.id;
        nav.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        history.replaceState(null, "", category === "all" ? location.pathname : `#cat=${category}`);
        render();
      });
      nav.appendChild(b);
    });
  }

  repo.list().then((list) => {
    products = list;
    // price sorting only makes sense once the inventory supplies prices
    if (sort && !products.some((p) => p.price !== null)) {
      [...sort.options].forEach((o) => { if (o.value.startsWith("price")) o.remove(); });
    }
    buildNav();
    if (sort) sort.addEventListener("change", render);
    render();
  });
}

/* ---------- product page ---------- */
const page = document.getElementById("product-page");
if (page) {
  const id = new URLSearchParams(location.search).get("id");
  repo.get(id).then((p) => {
    if (!p) {
      page.replaceChildren(el("p", "pp-missing", "המוצר לא נמצא."));
      const back = el("a", "pp-back", "חזרה לחנות"); back.href = base() + "shop/";
      page.appendChild(back);
      return;
    }
    document.title = `${p.name} | The Padel Club Azor`;

    const gallery = el("div", "pp-gallery");
    const main = el("div", `pp-main is-${p.category}`);
    if (p.images[0]) main.appendChild(productPicture(p.images[0], "(min-width: 1024px) 50vw, 100vw"));
    if (p.badge) main.appendChild(el("span", "product-badge", p.badge));
    gallery.appendChild(main);
    if (p.images.length > 1) {
      const thumbs = el("div", "pp-thumbs");
      p.images.forEach((img, i) => {
        const b = el("button", "pp-thumb"); b.type = "button";
        b.setAttribute("aria-label", `תמונה ${i + 1}`);
        b.appendChild(productPicture(img));
        b.addEventListener("click", () => { main.replaceChildren(productPicture(img)); if (p.badge) main.appendChild(el("span", "product-badge", p.badge)); });
        thumbs.appendChild(b);
      });
      gallery.appendChild(thumbs);
    }

    const info = el("div", "pp-info");
    info.appendChild(el("p", "eyebrow pp-cat", p.categoryLabel));
    info.appendChild(el("h1", "pp-title", p.name));
    if (cardOptions.showPrices && p.price !== null) {
      const price = el("p", "pp-price", formatPrice(p.price, p.currency));
      if (p.compareAtPrice !== null && p.compareAtPrice > p.price) price.appendChild(el("s", null, formatPrice(p.compareAtPrice, p.currency)));
      info.appendChild(price);
    }
    if (p.description) info.appendChild(el("p", "pp-body", p.description));

    const meta = el("ul", "pp-meta");
    const row = (k, v) => { const li = el("li"); li.appendChild(el("span", "pp-meta-key", k)); li.appendChild(el("span", "pp-meta-val", v)); return li; };
    meta.appendChild(row("מותג", "adidas"));
    if (p.sku) meta.appendChild(row("דגם", p.sku));
    meta.appendChild(row("קטגוריה", p.categoryLabel));
    info.appendChild(meta);

    const cart = el("button", "btn pp-cart", "הוסף לסל");
    cart.type = "button";
    if (!shopConfig.checkoutEnabled) {
      cart.setAttribute("aria-disabled", "true");
      cart.addEventListener("click", (e) => e.preventDefault());
      info.appendChild(cart);
      info.appendChild(el("p", "pp-note", "הרכישה אונליין עדיין לא פעילה."));
    } else {
      info.appendChild(cart);
    }
    if (p.referenceUrl) {
      const ref = el("a", "pp-ref", "לעמוד המוצר באתר adidas");
      ref.href = p.referenceUrl; ref.target = "_blank"; ref.rel = "noopener";
      info.appendChild(ref);
    }
    const back = el("a", "pp-back", "חזרה לחנות"); back.href = base() + "shop/";
    info.appendChild(back);

    page.replaceChildren(gallery, info);
    page.setAttribute("aria-busy", "false");
  });
}
})();
