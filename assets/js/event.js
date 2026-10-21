/**
 * Tournament landing page: the photo strip opens the same gallery popup the tournaments section uses.
 * The photos come from the JSON block that tools/sync_tournaments.py renders next to the strip.
 */
(() => {
  const root = document.querySelector("[data-event-gallery]");
  if (!root) return;
  const data = root.querySelector('script[type="application/json"]');
  let items = [];
  try { items = JSON.parse(data.textContent); } catch (e) { return; }
  if (!items.length || !window.PadelGallery) return;

  const open = (index) => window.PadelGallery.openGallery(items, { index, title: "תמונות מהטורניר האחרון במועדון" });
  root.querySelectorAll(".ev-shot").forEach((button, i) => {
    button.addEventListener("click", () => open(Number(button.dataset.index || i)));
  });
  const more = root.querySelector(".ev-shots-more");
  if (more) more.addEventListener("click", () => open(0));
})();
