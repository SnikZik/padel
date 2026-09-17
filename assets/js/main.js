/* Site behaviour. Classic script (runs from disk and from a server alike); loads after
   site.config.js, products/repository.js and products/card.js. */
(function () {
"use strict";

const { ProductRepository, InlineJsonSource, FetchJsonSource, InventoryApiSource, renderProductCard } = window.PadelShop;
const config = window.PADEL_CONFIG || {};
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const desktopMedia = window.matchMedia("(min-width: 768px)");

/* ---------- header: transparent over the hero, solid once scrolled ---------- */
const header = document.getElementById("site-header");
const alwaysSolid = header.hasAttribute("data-solid"); // pages without a hero keep the white header
function syncHeader() {
  header.classList.toggle("is-solid", alwaysSolid || window.scrollY > 24);
}
window.addEventListener("scroll", syncHeader, { passive: true });
syncHeader();

/* ---------- mobile drawer ---------- */
const menuBtn = document.getElementById("menu-btn");
const nav = document.getElementById("site-nav");
function setDrawer(open) {
  header.classList.toggle("is-open", open);
  document.body.classList.toggle("nav-open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "סגירת תפריט" : "פתיחת תפריט");
  if (open) nav.querySelector("a").focus();
}
menuBtn.addEventListener("click", () => setDrawer(!header.classList.contains("is-open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setDrawer(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && header.classList.contains("is-open")) { setDrawer(false); menuBtn.focus(); }
});
window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => { if (e.matches) setDrawer(false); });

/* ---------- hero video: the same tripod shot on every screen, a portrait slice on phones ----------
   The poster under it is the video's own first frame, so the fade-in never jumps. */
const video = document.getElementById("hero-video");
if (video) {
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!reducedMotion && !saveData) {
    const hero = video.closest(".hero");
    const file = desktopMedia.matches ? "hero_desktop.mp4" : "hero_mobile.mp4";
    video.muted = true; // the IDL property, not only the attribute: required for autoplay in some browsers
    video.addEventListener("playing", () => hero.classList.add("is-playing"));
    video.addEventListener("pause", () => hero.classList.remove("is-playing"));
    video.preload = "auto";
    video.src = (window.PADEL_BASE || "") + "assets/video/" + file;
    video.play().catch(() => { /* poster stays; autoplay was declined by the browser */ });
  } else {
    video.remove(); // reduced motion or data saver: the poster alone
  }
}

/* ---------- booking card: dock to the bottom of the screen once its own slot scrolls past,
   release again when the footer arrives, so it never covers the page's own ending ---------- */
const slot = document.getElementById("book-slot");
if (slot) {
  const card = slot.querySelector(".book-card");
  const footer = document.querySelector(".site-footer");
  let ticking = false;
  const sync = () => {
    ticking = false;
    const gap = desktopMedia.matches ? 20 : 12;
    // dock once the card's own place has scrolled above the top of the screen, release when it comes back
    const slotRect = slot.getBoundingClientRect();
    const docked = slot.classList.contains("is-docked") ? slotRect.bottom < card.offsetHeight + 8 : slotRect.bottom < 8;
    const footerVisible = footer.getBoundingClientRect().top < window.innerHeight - gap;
    slot.style.height = docked ? `${card.offsetHeight}px` : "";
    slot.classList.toggle("is-docked", docked);
    slot.classList.toggle("is-hidden", docked && footerVisible);
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  sync();
}

/* ---------- config-driven links ---------- */
document.querySelectorAll("[data-booking]").forEach((a) => { if (config.bookingUrl) a.href = config.bookingUrl; });
document.querySelectorAll("[data-waze]").forEach((a) => { if (config.wazeUrl) a.href = config.wazeUrl; });
document.querySelectorAll("[data-link]").forEach((a) => {
  const target = config.links && config.links[a.dataset.link];
  if (target) {
    a.href = target;
    if (/^https?:/.test(target)) { a.target = "_blank"; a.rel = "noopener"; }
  } else {
    // destination not supplied yet: keep the button as designed, but do nothing on click
    a.setAttribute("aria-disabled", "true");
    a.addEventListener("click", (e) => e.preventDefault());
    console.info(`[todo] link "${a.dataset.link}" has no destination yet (site.config.js → links)`);
  }
});

/* ---------- scroll spy for the header menu ---------- */
const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
const spied = navLinks
  .map((a) => document.querySelector(a.getAttribute("href")))
  .filter((el, i, arr) => el && arr.indexOf(el) === i);
if ("IntersectionObserver" in window && spied.length) {
  const spy = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((a) => {
      const isCurrent = a.getAttribute("href") === `#${visible.target.id}`;
      if (isCurrent) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }, { rootMargin: "-40% 0px -50% 0px", threshold: [0, .2, .5] });
  spied.forEach((el) => spy.observe(el));
}

/* ---------- reveals: subtle, only for content below the first screen ---------- */
if (!reducedMotion && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("reveal"); io.observe(el); }
  });
}

/* ---------- products ---------- */
const grid = document.getElementById("product-grid");
if (grid) {
  const shopConfig = config.shop || {};
  const repo = new ProductRepository([
    new InventoryApiSource(shopConfig.inventory || {}),
    new InlineJsonSource(),
    new FetchJsonSource((window.PADEL_BASE || "") + "data/products.json")
  ]);
  repo.list().then((products) => {
    grid.replaceChildren();
    if (!products.length) {
      const note = document.createElement("li");
      note.className = "grid-note";
      note.textContent = "המוצרים לא נטענו.";
      grid.appendChild(note);
    } else {
      products.forEach((p) => grid.appendChild(renderProductCard(p, {
        showPrices: Boolean(shopConfig.showPrices),
        showStock: Boolean(shopConfig.showStock)
      })));
    }
    grid.setAttribute("aria-busy", "false");
  });
}

/* ---------- footer year ---------- */
const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());

/* ---------- schema.org: add what the config knows ---------- */
const ld = document.getElementById("schema-business");
if (ld) {
  try {
    const data = JSON.parse(ld.textContent);
    if (config.phone) data.telephone = config.phone;
    if (config.openingHours) data.openingHours = config.openingHours;
    if (config.siteUrl) {
      data.url = config.siteUrl;
      data.image = data.image.map((src) => new URL(src, config.siteUrl).href);
    }
    ld.textContent = JSON.stringify(data);
  } catch { /* leave the static block as is */ }
}
})();
