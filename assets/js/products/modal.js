/**
 * Product popup (Snir, 18.9.2026): a product card opens its details over the page instead of the product page.
 * The card keeps its real link (shop/product.html?id=…) for new tabs, long presses and no-JS.
 * Native <dialog>: focus stays inside, Esc, the close button, a tap outside and the phone's back button all close it.
 * Content mirrors the product page: photo, category, name, details, availability, the adidas page. No cart.
 * Classic script: adds openProductModal to window.PadelShop. Built with DOM APIs, catalogue text is never HTML.
 */
(function (global) {
  "use strict";

  const ATTRIBUTE_LABELS = { shape: "צורה", level: "רמה", color: "צבע", pack: "אריזה" };
  let dialog = null;
  let pushed = false;
  let lastFocus = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function build() {
    dialog = el("dialog", "product-modal");
    dialog.setAttribute("aria-labelledby", "pm-title");
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // tap on the dimmed area
    dialog.addEventListener("close", () => {
      document.documentElement.classList.remove("modal-open");
      if (pushed) { pushed = false; history.back(); }
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    });
    window.addEventListener("popstate", () => { if (dialog.open) { pushed = false; dialog.close(); } });
    document.body.appendChild(dialog);
  }

  function content(p, { showPrices = false } = {}) {
    const shop = global.PadelShop;
    const frag = document.createDocumentFragment();

    const close = el("button", "pm-close");
    close.type = "button";
    close.setAttribute("aria-label", "סגירה");
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener("click", () => dialog.close());

    const grid = el("div", "pm-grid");
    const media = el("div", `pm-media is-${p.category}`);
    if (p.images[0]) {
      const picture = shop.productPicture(p.images[0], "(min-width: 768px) 440px, 100vw");
      const img = picture.querySelector("img");
      if (img) img.loading = "eager";
      media.appendChild(picture);
    }
    if (p.badge) media.appendChild(el("span", "product-badge", p.badge));

    const info = el("div", "pm-info");
    info.appendChild(el("p", "pm-cat", p.categoryLabel));
    const title = el("h2", "pm-title", p.name);
    title.id = "pm-title"; title.dir = "ltr"; title.lang = "en";
    info.appendChild(title);
    if (showPrices && p.price !== null) {
      const price = el("p", "pm-price", shop.formatPrice(p.price, p.currency));
      if (p.compareAtPrice !== null && p.compareAtPrice > p.price) price.appendChild(el("s", null, shop.formatPrice(p.compareAtPrice, p.currency)));
      info.appendChild(price);
    }
    if (p.description) info.appendChild(el("p", "pm-body", p.description));

    const meta = el("ul", "pm-meta");
    const row = (k, v) => { const li = el("li"); li.appendChild(el("span", "pm-meta-key", k)); li.appendChild(el("span", "pm-meta-val", v)); return li; };
    meta.appendChild(row("מותג", p.brand));
    if (p.sku) meta.appendChild(row("דגם", p.sku));
    meta.appendChild(row("קטגוריה", p.categoryLabel));
    Object.entries(p.attributes || {}).forEach(([k, v]) => meta.appendChild(row(ATTRIBUTE_LABELS[k] || k, String(v))));
    info.appendChild(meta);

    // no online purchase at this stage: the club store sells on the floor
    const stock = el("p", `pm-stock${p.inStore ? " is-available" : ""}`);
    stock.appendChild(el("i", "product-dot"));
    stock.appendChild(el("span", null, p.availabilityLabel));
    info.appendChild(stock);
    info.appendChild(el("p", "pm-note", "המוצר זמין לרכישה בחנות שבמתחם המועדון."));
    if (p.referenceUrl) {
      const ref = el("a", "pm-ref", "לעמוד המוצר באתר adidas");
      ref.href = p.referenceUrl; ref.target = "_blank"; ref.rel = "noopener";
      info.appendChild(ref);
    }

    grid.appendChild(media);
    grid.appendChild(info);
    frag.appendChild(close);
    frag.appendChild(grid);
    return frag;
  }

  function openProductModal(product, options) {
    if (!dialog) build();
    lastFocus = document.activeElement;
    dialog.replaceChildren(content(product, options));
    dialog.showModal();
    dialog.scrollTop = 0;
    document.documentElement.classList.add("modal-open");
    history.pushState({ padelProduct: product.id }, "");
    pushed = true;
  }

  global.PadelShop = Object.assign(global.PadelShop || {}, { openProductModal });
})(window);
