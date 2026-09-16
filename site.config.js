// Runtime configuration for The Padel Club Azor.
// Everything marked TODO was not supplied in the handoff. Leave it null: the UI hides
// what it cannot show instead of guessing. Fill a value and the page picks it up on reload.
window.PADEL_CONFIG = {
  siteUrl: null, // TODO production URL (used for canonical, og:image and schema once the domain exists)

  // Booking. 07_copy/content-he.json gives the Lazuz homepage; replace with the club's direct link when supplied.
  bookingUrl: "https://www.lazuz.co.il/",

  instagramUrl: "https://www.instagram.com/padelclub.azor/",

  // Navigation to ז׳בוטינסקי 28, אזור (address only, no coordinates were supplied).
  wazeUrl: "https://waze.com/ul?q=%D7%96%27%D7%91%D7%95%D7%98%D7%99%D7%A0%D7%A1%D7%A7%D7%99%2028%20%D7%90%D7%96%D7%95%D7%A8&navigate=yes",

  phone: null,          // TODO e.g. "+972-3-0000000" → appears in schema.org only when set
  openingHours: null,   // TODO schema.org format, e.g. ["Su-Th 06:00-21:00", "Fr 06:00-17:00", "Sa 07:00-23:00"]

  // CTA destinations that do not exist yet (no story page, no shop page, no events page).
  // null keeps the button as designed but inert. Set a URL or an in-page anchor when the target exists.
  links: {
    aboutStory: null,      // "הסיפור שלנו"
    shop: "shop/",         // "לחנות" / "לכל המוצרים" → the catalogue page
    communityEvents: null, // "אירועים וקהילה"
    eventsMenu: "#community" // menu item "אירועים": no events section yet, lands on the community block
  },

  shop: {
    showPrices: false,      // switch on only when the inventory connector supplies local ILS prices
    showStock: false,
    checkoutEnabled: false, // "הוסף לסל" stays inert until the store backend (WooCommerce / inventory) exists
    inventory: { provider: null, endpoint: null } // TODO third-party inventory system (name unknown yet)
  }
};
