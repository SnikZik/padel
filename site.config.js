// Runtime configuration for The Padel Club Azor.
// Everything marked TODO was not supplied in the handoff. Leave it null: the UI hides
// what it cannot show instead of guessing. Fill a value and the page picks it up on reload.
window.PADEL_CONFIG = {
  siteUrl: null, // TODO production URL (used for canonical, og:image and schema once the domain exists)

  // Booking. 07_copy/content-he.json gives the Lazuz homepage; replace with the club's direct link when supplied.
  bookingUrl: "https://www.lazuz.co.il/",
  bookingDock: false,   // booking card docking to the bottom of the screen while scrolling: off for now (Snir, 17.9); true turns it back on

  instagramUrl: "https://www.instagram.com/padelclub.azor/",

  // Navigation to ז׳בוטינסקי 28, אזור (address only, no coordinates were supplied).
  wazeUrl: "https://waze.com/ul?q=%D7%96%27%D7%91%D7%95%D7%98%D7%99%D7%A0%D7%A1%D7%A7%D7%99%2028%20%D7%90%D7%96%D7%95%D7%A8&navigate=yes",

  phone: null,          // TODO main phone, e.g. "050-000-0000" → footer "טלפון" tile (tel: link) and schema.org
  whatsappUrl: null,    // TODO e.g. "https://wa.me/972520000000" for 052-000-0000 → footer "וואטסאפ" tile
  facebookUrl: null,    // TODO the club's Facebook page → footer "פייסבוק" tile
  // TikTok: the footer shows it as "בקרוב", display only, until the account exists
  openingHours: null,   // TODO schema.org format, e.g. ["Su-Th 06:00-21:00", "Fr 06:00-17:00", "Sa 07:00-23:00"]

  // CTA destinations that do not exist yet (no story page, no shop page, no events page).
  // null keeps the button as designed but inert. Set a URL or an in-page anchor when the target exists.
  links: {
    aboutStory: null,      // "הסיפור שלנו"
    shop: "shop/",         // "לחנות" / "לכל המוצרים" → the catalogue page
    tournamentsUpcoming: null, // "טורנירים קרובים" (tournaments section, tablet and desktop): no destination yet
    communityJoin: null,   // "להצטרפות לקהילה" (tournaments community banner)
    contact: null          // footer "דברו איתנו": WhatsApp or phone link once supplied
  },

  shop: {
    showPrices: false,      // switch on only when the inventory connector supplies local ILS prices
    showStock: false,
    checkoutEnabled: false, // "הוסף לסל" stays inert until the store backend (WooCommerce / inventory) exists
    inventory: { provider: null, endpoint: null } // TODO third-party inventory system (name unknown yet)
  }
};
