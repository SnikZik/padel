/**
 * Product card: the one card component used on the homepage and on /shop/.
 * Retail structure: large neutral image tile (product floats, never touches the edges),
 * then small category, product name (max 3 lines), optional price, quiet "לפרטים" link.
 * Built with DOM APIs so catalogue text is never injected as HTML.
 * Classic script: adds renderProductCard to window.PadelShop.
 */
(function (global) {
  "use strict";

  const CTA_LABEL = "לפרטים";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function productHref(product) {
    if (product.url) return product.url;
    return `${global.PadelShop.base()}shop/product.html?id=${encodeURIComponent(product.id)}`;
  }

  /** <picture> with webp + fallback, paths prefixed with the page base. */
  function productPicture(image, sizes) {
    const base = global.PadelShop.base();
    const picture = document.createElement("picture");
    if (image.webp) {
      const source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = base + image.webp;
      picture.appendChild(source);
    }
    const img = document.createElement("img");
    img.src = base + image.src;
    img.alt = image.alt;
    img.loading = "lazy";
    img.decoding = "async";
    if (sizes) img.sizes = sizes;
    if (image.width) img.width = image.width;
    if (image.height) img.height = image.height;
    picture.appendChild(img);
    return picture;
  }

  /**
   * @param {object} product  normalized Product (see repository.js)
   * @param {{showPrices?: boolean, showStock?: boolean}} options
   * @returns {HTMLLIElement}
   */
  function renderProductCard(product, { showPrices = false, showStock = false } = {}) {
    const li = el("li", "product-card");
    li.dataset.category = product.category;

    const link = el("a", "product-link");
    link.href = productHref(product);
    if (product.url && /^https?:/.test(product.url)) { link.target = "_blank"; link.rel = "noopener"; }

    // image tile
    const media = el("div", `product-media is-${product.category}`);
    if (product.images[0]) media.appendChild(productPicture(product.images[0], "(min-width: 768px) 25vw, 45vw"));
    if (product.badge) media.appendChild(el("span", "product-badge", product.badge));
    link.appendChild(media);

    // text
    const body = el("div", "product-body");
    body.appendChild(el("p", "product-cat", product.categoryLabel));
    body.appendChild(el("h3", "product-name", product.name));
    if (showPrices && product.price !== null) {
      const price = el("p", "product-price", global.PadelShop.formatPrice(product.price, product.currency));
      if (product.compareAtPrice !== null && product.compareAtPrice > product.price) {
        price.appendChild(el("s", null, global.PadelShop.formatPrice(product.compareAtPrice, product.currency)));
      }
      body.appendChild(price);
    }
    if (showStock && product.stock !== null) {
      body.appendChild(el("p", "product-stock", product.stock > 0 ? "במלאי" : "אזל מהמלאי"));
    }
    body.appendChild(el("span", "product-cta", CTA_LABEL));
    link.appendChild(body);

    li.appendChild(link);
    return li;
  }

  global.PadelShop = Object.assign(global.PadelShop || {}, { renderProductCard, productPicture, productHref });
})(window);
