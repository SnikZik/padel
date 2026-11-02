/**
 * Measurement (Snir, 2.11.2026).
 *
 * One file holds everything the site reports: the container, the page view and the clicks that count as
 * a lead for this club, which are WhatsApp, phone, court booking and tournament registration.
 *
 * site.config.js decides what loads:
 *   gtmId        "GTM-XXXXXXX"   the container. When it is set, GA4, Google Ads and the Meta pixel are
 *                                tags inside it and nothing else is injected from here, so nothing fires twice.
 *   ga4Id        "G-XXXXXXXXXX"  loaded directly only when there is no container.
 *   metaPixelId  "1234567890"    loaded directly only when there is no container.
 *
 * Every event is pushed to window.dataLayer with the same shape:
 *   { event: "cta_click", cta: "whatsapp" | "phone" | "booking" | "waze" | "registration",
 *     cta_location: the section the click came from, cta_url: the destination }
 * In GTM you build a trigger on cta_click and read those three, which is all a conversion needs.
 * Classic script, no build step, runs from disk and from the server alike.
 */
(function (global, doc) {
  "use strict";

  var config = global.PADEL_CONFIG || {};
  global.dataLayer = global.dataLayer || [];
  function push(payload) { global.dataLayer.push(payload); }

  /* ---------- the container, or the single tags when there is no container ---------- */
  if (config.gtmId) {
    push({ "gtm.start": Date.now(), event: "gtm.js" });
    var gtm = doc.createElement("script");
    gtm.async = true;
    gtm.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(config.gtmId);
    doc.head.appendChild(gtm);
  } else {
    if (config.ga4Id) {
      var ga = doc.createElement("script");
      ga.async = true;
      ga.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(config.ga4Id);
      doc.head.appendChild(ga);
      global.gtag = function () { global.dataLayer.push(arguments); };
      global.gtag("js", new Date());
      global.gtag("config", config.ga4Id);
    }
    if (config.metaPixelId) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(global,doc,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      global.fbq("init", config.metaPixelId);
      global.fbq("track", "PageView");
    }
  }

  /* ---------- what counts as a lead here ---------- */
  var SECTIONS = {
    "ev-hero": "hero", "pv-hero": "hero", hero: "hero", "book-card": "booking card",
    "ev-cta": "registration", "pv-section": "registration", "site-footer": "footer",
    "play-section": "training", "site-header": "header", "book-strip": "sticky strip",
    "events-banner": "events banner", shop: "shop", tournaments: "tournaments"
  };

  function sectionOf(el) {
    var node = el;
    while (node && node !== doc.body) {
      if (node.id && SECTIONS[node.id]) return SECTIONS[node.id];
      if (node.className && typeof node.className === "string") {
        for (var i = 0; i < node.classList.length; i++) {
          if (SECTIONS[node.classList[i]]) return SECTIONS[node.classList[i]];
        }
      }
      node = node.parentElement;
    }
    return "page";
  }

  function kindOf(link) {
    var href = link.getAttribute("href") || "";
    if (/^tel:/i.test(href)) return "phone";
    if (/wa\.me|api\.whatsapp\.com|web\.whatsapp\.com/i.test(href)) return "whatsapp";
    if (link.hasAttribute("data-booking") || /lazuz\.co\.il/i.test(href)) return "booking";
    if (link.hasAttribute("data-waze") || /waze\.com/i.test(href)) return "waze";
    if (/instagram\.com|facebook\.com|tiktok\.com/i.test(href)) return "social";
    return null;
  }

  doc.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a[href], button") : null;
    if (!link) return;
    var kind = link.tagName === "A" ? kindOf(link) : null;

    // the registration buttons on the tournament pages are WhatsApp or phone links, and they are the lead
    var location = sectionOf(link);
    if (kind && (location === "registration" || location === "hero") && doc.body.className.indexOf("page-") === 0 &&
        /page-event|page-poster/.test(doc.body.className) && (kind === "whatsapp" || kind === "phone")) {
      kind = "registration";
    }
    if (!kind) return;

    push({
      event: "cta_click",
      cta: kind,
      cta_location: location,
      cta_url: link.getAttribute("href") || ""
    });

    // when the pixel runs on its own, give it the standard names it expects
    if (!config.gtmId && global.fbq) {
      if (kind === "registration") global.fbq("track", "Lead");
      else if (kind === "whatsapp" || kind === "phone") global.fbq("track", "Contact");
      else if (kind === "booking") global.fbq("track", "Schedule");
    }
  }, true);

  /* ---------- two softer signals, useful for remarketing ---------- */
  global.addEventListener("padel:product-view", function (e) {
    push({ event: "product_view", product_id: (e.detail && e.detail.id) || "", product_name: (e.detail && e.detail.name) || "" });
  });
  global.addEventListener("padel:gallery-open", function (e) {
    push({ event: "gallery_open", gallery: (e.detail && e.detail.title) || "" });
  });
})(window, document);
