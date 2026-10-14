/* Tournaments: filter chips (הכל / קרוב / רמה X) over the cards rendered by tools/sync_tournaments.py.
   "קרוב" shows the next tournament from today on (every tournament on that date). Without JS all cards stay visible. */
(() => {
  const root = document.getElementById("tournaments");
  if (!root) return;
  const chips = [...root.querySelectorAll(".tournaments-chip")];
  const cards = [...root.querySelectorAll(".tournament-card")];
  const empty = root.querySelector(".tournaments-empty");
  if (!chips.length || !cards.length) return;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const next = cards.map((c) => c.dataset.date).filter((d) => d >= today).sort()[0];

  const photosOf = (card) => {
    const tag = card.querySelector(".tournament-gallery");
    if (!tag) return null;
    try { return JSON.parse(tag.textContent); } catch (e) { return null; }
  };

  // a tournament whose date has passed reads "הסתיים", loses its registration button, and opens its photos
  // in a popup if the club sent any (Snir, 14.10.2026)
  cards.forEach((card) => {
    if (card.dataset.date >= today) return;
    card.classList.add("is-past");
    const media = card.querySelector(".tournament-media");
    if (media && !media.querySelector(".tournament-past")) {
      const flag = document.createElement("p");
      flag.className = "tournament-past";
      flag.textContent = "הסתיים";
      media.appendChild(flag);
    }
    const cta = card.querySelector(".tournament-cta");
    if (!cta) return;
    const photos = photosOf(card);
    if (photos && photos.length && window.PadelGallery) {
      const name = (card.querySelector(".tournament-title") || {}).textContent || "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = cta.className + " tournament-cta-photos";
      button.textContent = "טורניר שהסתיים, לתמונות";
      const open = () => window.PadelGallery.openGallery(photos, { title: `תמונות מהטורניר, ${name}`.trim() });
      button.addEventListener("click", open);
      cta.replaceWith(button);
      if (media) {
        media.classList.add("is-clickable");
        media.addEventListener("click", open);
      }
    } else {
      cta.textContent = "טורניר שהסתיים";
      cta.removeAttribute("href");
      cta.removeAttribute("target");
      cta.setAttribute("aria-disabled", "true");
    }
  });

  // the banner under the hero names the next tournament from today on, even when the page was built long ago
  const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const banner = document.querySelector(".events-banner");
  if (banner && (banner.dataset.date || "") < today) {
    const label = banner.querySelector(".events-banner-label");
    const title = banner.querySelector(".events-banner-title");
    const time = banner.querySelector(".events-banner-time");
    const card = next ? cards.find((c) => c.dataset.date === next) : null;
    if (card) {
      banner.dataset.date = next;
      if (title) title.innerHTML = card.querySelector(".tournament-title").innerHTML;
      if (time) {
        const d = new Date(`${next}T00:00:00`);
        time.dateTime = next;
        time.textContent = `${d.getDate()} ב${MONTHS[d.getMonth()]}`;
      }
    } else {
      // nothing upcoming: the banner names the last tournament that was played
      const last = cards.map((c) => c.dataset.date).filter((d) => d < today).sort().pop();
      const played = last ? cards.find((c) => c.dataset.date === last) : null;
      banner.dataset.date = "";
      if (label) label.textContent = played ? "הטורניר האחרון" : "אירועים במועדון";
      if (title) {
        if (played) title.innerHTML = played.querySelector(".tournament-title").innerHTML;
        else title.textContent = "טורנירים במועדון";
      }
      if (time) {
        if (played) {
          const d = new Date(`${last}T00:00:00`);
          time.dateTime = last;
          time.textContent = `${d.getDate()} ב${MONTHS[d.getMonth()]}`;
        } else {
          time.remove();
        }
      }
    }
  }

  const matches = (card, filter) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return Boolean(next) && card.dataset.date === next;
    if (filter === "past") return card.dataset.date < today;
    if (filter.startsWith("level:")) return card.dataset.level === filter.slice(6);
    return true;
  };

  const EMPTY_TEXT = { upcoming: "אין כרגע טורניר קרוב.", past: "עוד לא הסתיימו טורנירים." };

  const apply = (filter) => {
    let shown = 0;
    cards.forEach((card) => {
      const show = matches(card, filter);
      card.hidden = !show;
      if (show) shown += 1;
    });
    chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.filter === filter)));
    if (empty) {
      empty.textContent = EMPTY_TEXT[filter] || "אין טורנירים בקטגוריה הזו.";
      empty.hidden = shown > 0;
    }
  };

  chips.forEach((chip) => chip.addEventListener("click", () => apply(chip.dataset.filter)));
})();
