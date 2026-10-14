/**
 * Photo gallery popup (Snir, 14.10.2026): a finished tournament opens the club's photos over the page,
 * the same way a product opens its details. Native <dialog>: focus stays inside, Esc, the close button,
 * a tap outside and the phone's back button all close it. Arrows, swipe and the thumbnail strip move between
 * photos, and the two neighbours are fetched ahead so the next one is already there.
 * Classic script: adds openGallery to window.PadelGallery. Built with DOM APIs, nothing is written as HTML.
 */
(function (global) {
  "use strict";

  let dialog = null, items = [], index = 0, pushed = false, lastFocus = null;
  let figure = null, counter = null, strip = null, caption = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(path, cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (cls) svg.setAttribute("class", cls);
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  }

  function picture(item, { eager = false, thumb = false } = {}) {
    const pic = document.createElement("picture");
    if (item.webp) {
      const source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = (global.PADEL_BASE || "") + item.webp;
      pic.appendChild(source);
    }
    const img = document.createElement("img");
    img.src = (global.PADEL_BASE || "") + item.src;
    img.alt = thumb ? "" : (item.alt || "");
    if (item.width) img.width = item.width;
    if (item.height) img.height = item.height;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (thumb) img.setAttribute("aria-hidden", "true");
    pic.appendChild(img);
    return pic;
  }

  function preload(i) {
    const item = items[i];
    if (!item) return;
    const img = new Image();
    img.src = (global.PADEL_BASE || "") + (item.webp || item.src);
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    figure.replaceChildren(picture(item, { eager: true }));
    caption.textContent = item.alt || "";
    counter.textContent = `${index + 1} מתוך ${items.length}`;
    [...strip.children].forEach((b, n) => {
      b.setAttribute("aria-current", String(n === index));
      if (n === index) b.scrollIntoView({ block: "nearest", inline: "center" });
    });
    preload(index + 1);
    preload(index - 1);
  }

  function build() {
    dialog = el("dialog", "gallery-modal");
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => {
      document.documentElement.classList.remove("modal-open");
      if (pushed) { pushed = false; history.back(); }
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    });
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { show(index + 1); e.preventDefault(); }       // right to left: left goes forward
      else if (e.key === "ArrowRight") { show(index - 1); e.preventDefault(); }
      else if (e.key === "Home") { show(0); e.preventDefault(); }
      else if (e.key === "End") { show(items.length - 1); e.preventDefault(); }
    });
    window.addEventListener("popstate", () => { if (dialog.open) { pushed = false; dialog.close(); } });

    let startX = null;
    dialog.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
    dialog.addEventListener("touchend", (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 48) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });

    document.body.appendChild(dialog);
  }

  function openGallery(list, options) {
    const opts = options || {};
    items = (list || []).filter((i) => i && i.src);
    if (!items.length) return;
    if (!dialog) build();
    lastFocus = document.activeElement;

    const head = el("div", "gallery-head");
    const title = el("h2", "gallery-title", opts.title || "תמונות מהטורניר");
    title.id = "gallery-title";
    counter = el("p", "gallery-counter");
    head.appendChild(title);
    head.appendChild(counter);

    const close = el("button", "gallery-close");
    close.type = "button";
    close.setAttribute("aria-label", "סגירה");
    close.appendChild(icon("M6 6l12 12M18 6L6 18"));
    close.addEventListener("click", () => dialog.close());

    const stage = el("div", "gallery-stage");
    figure = el("figure", "gallery-figure");
    const prev = el("button", "gallery-nav gallery-prev");
    prev.type = "button";
    prev.setAttribute("aria-label", "התמונה הקודמת");
    prev.appendChild(icon("M15 5l-7 7 7 7"));
    prev.addEventListener("click", () => show(index - 1));
    const next = el("button", "gallery-nav gallery-next");
    next.type = "button";
    next.setAttribute("aria-label", "התמונה הבאה");
    next.appendChild(icon("M9 5l7 7-7 7"));
    next.addEventListener("click", () => show(index + 1));
    stage.appendChild(figure);
    stage.appendChild(prev);
    stage.appendChild(next);

    caption = el("p", "gallery-caption");

    strip = el("div", "gallery-strip");
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "כל התמונות");
    items.forEach((item, n) => {
      const b = el("button", "gallery-thumb");
      b.type = "button";
      b.setAttribute("aria-label", `תמונה ${n + 1}`);
      b.appendChild(picture(item, { thumb: true }));
      b.addEventListener("click", () => show(n));
      strip.appendChild(b);
    });

    dialog.setAttribute("aria-labelledby", "gallery-title");
    dialog.replaceChildren(close, head, stage, caption, strip);
    dialog.showModal();
    document.documentElement.classList.add("modal-open");
    show(Math.min(Math.max(opts.index || 0, 0), items.length - 1));
    history.pushState({ padelGallery: true }, "");
    pushed = true;
  }

  global.PadelGallery = Object.assign(global.PadelGallery || {}, { openGallery });
})(window);
