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

  // a tournament whose date has passed reads "הסתיים" and loses its registration button
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
    if (cta) {
      cta.textContent = "הטורניר הסתיים";
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
      banner.dataset.date = "";
      if (label) label.textContent = "אירועים במועדון";
      if (title) title.textContent = "טורנירים במועדון";
      if (time) time.remove();
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
