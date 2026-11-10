/**
 * Quote builder (Snir, 8.11.2026). A private screen, not linked from the site.
 *
 * Every line of a quote is a module from data/quote-modules.json: a title, a sentence that says what the client
 * gets, a unit, a quantity and a price. Inside a quote each of those is editable, so the catalogue is a starting
 * point. Nothing is invented: a module with no price shows an empty price field until someone types one.
 *
 * The result prints as an A4 page. Printing also files the quote in the saved list, so it can be opened
 * and edited later. Everything lives in this browser only (localStorage), there is no server behind this.
 */
(function (global, doc) {
  "use strict";

  var DRAFT_KEY = "padel.quote.draft.v1";
  var SAVED_KEY = "padel.quote.saved.v1";
  var state = { meta: {}, lines: [], catalogue: null, currentId: null, dirty: false };

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function money(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, days) {
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function he(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    var months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    return d.getDate() + " ב" + months[d.getMonth()] + " " + d.getFullYear();
  }

  /* ---------- feedback: a line about what just happened, with a few seconds to take it back ---------- */
  var UNDO_MS = 7000;

  function toastBox() {
    var box = doc.getElementById("qb-toasts");
    if (!box) {
      box = el("div", "qb-toasts");
      box.id = "qb-toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      doc.body.appendChild(box);
    }
    return box;
  }

  function toast(text, undoLabel, undoFn) {
    var box = toastBox();
    var node = el("div", "qb-toast");
    node.appendChild(el("span", "qb-toast-text", text));
    var timer;
    function close() { clearTimeout(timer); node.remove(); }
    if (undoFn) {
      var b = el("button", "qb-toast-undo", undoLabel || "ביטול");
      b.type = "button";
      b.addEventListener("click", function () { close(); undoFn(); });
      node.appendChild(b);
    }
    var x = el("button", "qb-toast-x", "✕");
    x.type = "button"; x.title = "סגירה"; x.setAttribute("aria-label", "סגירה");
    x.addEventListener("click", close);
    node.appendChild(x);
    var bar = el("i", "qb-toast-bar");
    bar.style.animationDuration = UNDO_MS + "ms";
    node.appendChild(bar);
    box.appendChild(node);
    while (box.children.length > 3) box.firstElementChild.remove();
    timer = setTimeout(close, UNDO_MS);
    return node;
  }

  function flashLine(uid) {
    var row = doc.querySelector('.qb-line[data-uid="' + uid + '"]');
    if (!row) return;
    row.classList.add("is-new");
    setTimeout(function () { row.classList.remove("is-new"); }, 2200);
    var box = row.getBoundingClientRect();
    if (box.top < 0 || box.bottom > global.innerHeight) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function flashChip(modId) {
    var chip = doc.querySelector('.qb-chip[data-mod="' + modId + '"]');
    if (!chip) return;
    chip.classList.add("is-hit");
    setTimeout(function () { chip.classList.remove("is-hit"); }, 700);
  }

  /* ---------- totals ---------- */
  function totals() {
    var sub = state.lines.reduce(function (sum, l) {
      var price = parseFloat(l.price);
      var qty = parseFloat(l.qty);
      return sum + (isNaN(price) || isNaN(qty) ? 0 : price * qty);
    }, 0);
    var discount = parseFloat(state.meta.discount) || 0;
    var afterDiscount = Math.max(sub - discount, 0);
    var vat = state.meta.withVat ? afterDiscount * (state.catalogue.vatPercent / 100) : 0;
    var missing = state.lines.filter(function (l) { return l.price === "" || l.price === null || isNaN(parseFloat(l.price)); }).length;
    return { sub: sub, discount: discount, afterDiscount: afterDiscount, vat: vat, total: afterDiscount + vat, missing: missing };
  }

  /* ---------- the picker ---------- */
  function renderCatalogue() {
    var box = doc.getElementById("qb-catalogue");
    box.replaceChildren();
    state.catalogue.categories.forEach(function (cat) {
      var group = el("section", "qb-group");
      group.appendChild(el("h3", null, cat.label));
      var list = el("div", "qb-chips");
      cat.modules.forEach(function (mod) {
        var wrap = el("div", "qb-chip-wrap");
        var b = el("button", "qb-chip");
        b.type = "button";
        b.dataset.mod = mod.id;
        b.appendChild(el("span", null, mod.title));
        b.appendChild(el("i", "qb-chip-count"));
        b.title = "הוספה להצעה";
        b.addEventListener("click", function () { addLine(cat, mod); });
        wrap.appendChild(b);
        var minus = el("button", "qb-chip-minus", "הסרה");
        minus.type = "button";
        minus.dataset.mod = mod.id;
        minus.title = "הסרת הסעיף הזה מההצעה";
        minus.hidden = true;
        minus.addEventListener("click", function () { removeLast(mod); });
        wrap.appendChild(minus);
        list.appendChild(wrap);
      });
      group.appendChild(list);
      box.appendChild(group);
    });
  }

  function addLine(cat, mod) {
    var line = {
      uid: "l" + Date.now() + Math.random().toString(36).slice(2, 6),
      modId: mod.id,
      category: cat.label,
      title: mod.title,
      desc: mod.desc || "",
      unit: mod.unit || "",
      qty: mod.qty === null || mod.qty === undefined ? 1 : mod.qty,
      price: mod.price === null || mod.price === undefined ? "" : mod.price
    };
    state.lines.push(line);
    renderLines();
    save();
    flashChip(mod.id);
    flashLine(line.uid);
    toast("נוסף להצעה: " + mod.title, "ביטול", function () { dropLine(line.uid, mod.title); });
  }

  // remove a line by its id, no undo offer: this is itself the undo
  function dropLine(uid, title) {
    var i = state.lines.findIndex(function (l) { return l.uid === uid; });
    if (i === -1) return;
    state.lines.splice(i, 1);
    renderLines();
    save();
    if (title) toast("הוסר: " + title);
  }

  // remove a line, and let it come back to the same place
  function removeLine(i) {
    var line = state.lines[i];
    if (!line) return;
    state.lines.splice(i, 1);
    renderLines();
    save();
    toast("הוסר: " + line.title, "החזרה", function () {
      state.lines.splice(Math.min(i, state.lines.length), 0, line);
      renderLines();
      save();
      flashLine(line.uid);
    });
  }

  function removeLast(mod) {
    for (var i = state.lines.length - 1; i >= 0; i--) {
      if (state.lines[i].modId === mod.id) { removeLine(i); return; }
    }
  }

  function refreshChips() {
    var counts = {};
    state.lines.forEach(function (l) { if (l.modId) counts[l.modId] = (counts[l.modId] || 0) + 1; });
    Array.prototype.forEach.call(doc.querySelectorAll(".qb-chip"), function (chip) {
      var n = counts[chip.dataset.mod] || 0;
      chip.classList.toggle("is-in", n > 0);
      var badge = chip.querySelector(".qb-chip-count");
      if (badge) badge.textContent = n > 1 ? String(n) : n === 1 ? "✓" : "";
    });
    Array.prototype.forEach.call(doc.querySelectorAll(".qb-chip-minus"), function (minus) {
      minus.hidden = !counts[minus.dataset.mod];
    });
  }

  /* ---------- the quote's own lines ---------- */
  function renderLines() {
    var box = doc.getElementById("qb-lines");
    box.replaceChildren();
    if (!state.lines.length) {
      box.appendChild(el("p", "qb-empty", "בחרו רכיבים מהרשימה למעלה והם יופיעו כאן."));
    }
    state.lines.forEach(function (line, i) {
      var row = el("div", "qb-line");
      row.dataset.uid = line.uid;

      var head = el("div", "qb-line-head");
      var title = el("input", "qb-line-title");
      title.value = line.title;
      title.setAttribute("aria-label", "שם הסעיף");
      title.addEventListener("input", function () { line.title = title.value; renderPreview(); save(); });
      head.appendChild(title);

      var tools = el("div", "qb-line-tools");
      [["↑", -1, "העלאת הסעיף"], ["↓", 1, "הורדת הסעיף"]].forEach(function (pair) {
        var b = el("button", "qb-icon", pair[0]);
        b.type = "button"; b.title = pair[2]; b.setAttribute("aria-label", pair[2]);
        b.addEventListener("click", function () {
          var to = i + pair[1];
          if (to < 0 || to >= state.lines.length) return;
          state.lines.splice(to, 0, state.lines.splice(i, 1)[0]);
          renderLines(); save();
        });
        tools.appendChild(b);
      });
      var del = el("button", "qb-icon qb-del", "הסרה");
      del.type = "button"; del.title = "הסרת הסעיף מההצעה"; del.setAttribute("aria-label", "הסרת הסעיף מההצעה");
      del.addEventListener("click", function () { removeLine(i); });
      tools.appendChild(del);
      head.appendChild(tools);
      row.appendChild(head);

      var desc = el("textarea", "qb-line-desc");
      desc.value = line.desc;
      desc.rows = 2;
      desc.placeholder = "מה הלקוח מקבל בסעיף הזה";
      desc.setAttribute("aria-label", "תיאור הסעיף");
      desc.addEventListener("input", function () { line.desc = desc.value; renderPreview(); save(); });
      row.appendChild(desc);

      var nums = el("div", "qb-line-nums");
      [
        { key: "qty", label: "כמות", width: "qb-w-qty" },
        { key: "unit", label: "יחידה", width: "qb-w-unit", text: true },
        { key: "price", label: "מחיר ליחידה", width: "qb-w-price" }
      ].forEach(function (f) {
        var wrap = el("label", "qb-field " + f.width);
        wrap.appendChild(el("span", null, f.label));
        var input = doc.createElement("input");
        input.type = f.text ? "text" : "number";
        if (!f.text) { input.min = "0"; input.step = "1"; }
        input.value = line[f.key];
        input.addEventListener("input", function () {
          line[f.key] = input.value;
          renderTotals(); renderPreview(); save();
        });
        wrap.appendChild(input);
        nums.appendChild(wrap);
      });
      var sum = el("p", "qb-line-sum");
      sum.textContent = lineSum(line);
      nums.appendChild(sum);
      row.appendChild(nums);
      box.appendChild(row);
    });
    renderTotals();
    renderPreview();
    refreshChips();
  }

  function lineSum(line) {
    var p = parseFloat(line.price), q = parseFloat(line.qty);
    if (isNaN(p) || isNaN(q)) return "חסר מחיר";
    return money(p * q) + " " + state.catalogue.currency;
  }

  /* ---------- totals and preview ---------- */
  function renderTotals() {
    var t = totals();
    var box = doc.getElementById("qb-totals");
    box.replaceChildren();
    var rows = [["סכום ביניים", money(t.sub)]];
    if (t.discount) rows.push(["הנחה", "-" + money(t.discount)]);
    if (state.meta.withVat) rows.push(["מע\"מ " + state.catalogue.vatPercent + "%", money(t.vat)]);
    rows.push(["סך הכול", money(t.total)]);
    rows.forEach(function (r, i) {
      var line = el("div", "qb-total" + (i === rows.length - 1 ? " is-final" : ""));
      line.appendChild(el("span", null, r[0]));
      line.appendChild(el("b", null, r[1] + " " + state.catalogue.currency));
      box.appendChild(line);
    });
    var warn = doc.getElementById("qb-warn");
    warn.textContent = t.missing ? "שימו לב: " + t.missing + " סעיפים בלי מחיר, הם לא נספרים בסכום." : "";
    warn.hidden = !t.missing;
    // also refresh the lines' own sums without rebuilding the inputs
    state.lines.forEach(function (line) {
      var row = doc.querySelector('.qb-line[data-uid="' + line.uid + '"] .qb-line-sum');
      if (row) row.textContent = lineSum(line);
    });
  }

  function renderPreview() {
    var m = state.meta, c = state.catalogue, t = totals();
    doc.getElementById("qp-title").textContent = m.title || "הצעת מחיר לאירוע";
    doc.getElementById("qp-client").textContent = m.client ? "לכבוד " + m.client : "";
    var facts = [];
    if (m.eventDate) facts.push("תאריך האירוע " + he(m.eventDate));
    if (m.hours) facts.push(m.hours);
    if (m.guests) facts.push(m.guests + " משתתפים");
    doc.getElementById("qp-facts").textContent = facts.join(" · ");
    doc.getElementById("qp-date").textContent = "תאריך ההצעה " + he(m.quoteDate || today());
    doc.getElementById("qp-intro").textContent = m.intro || "";

    var body = doc.getElementById("qp-lines");
    body.replaceChildren();
    state.lines.forEach(function (l) {
      var row = el("tr");
      var what = el("td");
      what.appendChild(el("b", null, l.title));
      if (l.desc) what.appendChild(el("span", "qp-desc", l.desc));
      row.appendChild(what);
      row.appendChild(el("td", "qp-qty", (l.qty || "") + (l.unit ? " " + l.unit : "")));
      var p = parseFloat(l.price), q = parseFloat(l.qty);
      row.appendChild(el("td", "qp-price", isNaN(p) || isNaN(q) ? "לפי בחירה" : money(p * q) + " " + c.currency));
      body.appendChild(row);
    });

    var sums = doc.getElementById("qp-sums");
    sums.replaceChildren();
    var rows = [["סכום ביניים", money(t.sub)]];
    if (t.discount) rows.push(["הנחה", "-" + money(t.discount)]);
    if (m.withVat) rows.push(["מע\"מ " + c.vatPercent + "%", money(t.vat)]);
    rows.push(["סך הכול", money(t.total)]);
    rows.forEach(function (r, i) {
      var line = el("div", "qp-sum" + (i === rows.length - 1 ? " is-final" : ""));
      line.appendChild(el("span", null, r[0]));
      line.appendChild(el("b", null, r[1] + " " + c.currency));
      sums.appendChild(line);
    });

    var media = c.media || {};
    var base = global.PADEL_BASE || "";
    var capOf = {};
    (media.photos || []).forEach(function (ph) { capOf[ph.src] = ph.caption || ""; });

    // page 1
    var cover = doc.getElementById("qp-cover");
    var coverSrc = m.coverSrc || media.cover;
    cover.hidden = !(m.showCover && coverSrc);
    if (!cover.hidden) {
      var cimg = doc.getElementById("qp-cover-img");
      cimg.src = base + coverSrc;
      cimg.alt = capOf[coverSrc] || "מתחם The Padel Club Azor";
      doc.getElementById("qp-cover-title").textContent = m.title || "הצעת מחיר לאירוע";
      doc.getElementById("qp-cover-client").textContent = m.client ? "לכבוד " + m.client : "";
      doc.getElementById("qp-cover-facts").textContent = facts.join(" · ");
      doc.getElementById("qp-cover-intro").textContent = m.intro || "";
    }

    // a band of photos inside the offer page
    var strip = doc.getElementById("qp-strip");
    var sPicks = (m.strip || []).filter(function (src) { return capOf[src] !== undefined; });
    strip.hidden = !(m.showStrip && sPicks.length);
    strip.replaceChildren();
    if (!strip.hidden) {
      strip.dataset.count = String(sPicks.length);
      sPicks.forEach(function (src) {
        var fig = el("figure", "qp-band");
        var bimg = doc.createElement("img");
        bimg.src = base + src; bimg.alt = capOf[src] || "";
        fig.appendChild(bimg);
        strip.appendChild(fig);
      });
    }

    // a page of photos on its own
    var gal = doc.getElementById("qp-gallery");
    var gPicks = (m.gallery || []).filter(function (src) { return capOf[src] !== undefined; });
    gal.hidden = !(m.showGallery && gPicks.length);
    if (!gal.hidden) {
      doc.getElementById("qp-gallery-title").textContent = c.galleryTitle || "עוד מהמתחם";
      var gg = doc.getElementById("qp-grid");
      gg.replaceChildren();
      gg.dataset.count = String(gPicks.length);
      gPicks.forEach(function (src) {
        var gfig = el("figure", "qp-tile");
        var gimg = doc.createElement("img");
        gimg.src = base + src; gimg.alt = capOf[src] || "";
        gfig.appendChild(gimg);
        if (capOf[src]) gfig.appendChild(el("figcaption", null, capOf[src]));
        gg.appendChild(gfig);
      });
    }

    // the closing page
    var closing = doc.getElementById("qp-closing");
    var picks = (m.collage || []).filter(function (src) { return capOf[src] !== undefined; });
    closing.hidden = !(m.showClosing && picks.length);
    if (!closing.hidden) {
      doc.getElementById("qp-closing-title").textContent = c.closingTitle || "ככה זה נראה אצלנו";
      var grid = doc.getElementById("qp-collage");
      grid.replaceChildren();
      grid.dataset.count = String(picks.length);
      picks.forEach(function (src, i) {
        var fig = el("figure", "qp-tile" + (i === 0 ? " is-big" : ""));
        var img = doc.createElement("img");
        img.src = base + src; img.alt = capOf[src] || "";
        fig.appendChild(img);
        if (capOf[src]) fig.appendChild(el("figcaption", null, capOf[src]));
        grid.appendChild(fig);
      });
      doc.getElementById("qp-outro").textContent = m.outro || "";
    }

    var video = doc.getElementById("qp-video");
    video.hidden = !(m.showVideo && media.videoUrl && !closing.hidden);
    if (!video.hidden) {
      video.replaceChildren();
      video.appendChild(doc.createTextNode("עוד תמונות וסרטונים מאירועים אצלנו "));
      var vb = doc.createElement("bdi");
      vb.dir = "ltr";
      vb.textContent = media.videoUrl;
      video.appendChild(vb);
    }

    var terms = doc.getElementById("qp-terms");
    terms.replaceChildren();
    (m.terms || []).forEach(function (line) { terms.appendChild(el("li", null, line)); });
  }

  /* ---------- draft ---------- */
  function save() {
    state.dirty = true;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ meta: state.meta, lines: state.lines, currentId: state.currentId }));
    } catch (e) { /* private window */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  /* ---------- meta fields ---------- */
  function bindMeta() {
    var fields = ["title", "client", "eventDate", "hours", "guests", "quoteDate", "discount", "intro", "outro"];
    fields.forEach(function (key) {
      var input = doc.getElementById("qb-" + key);
      if (!input) return;
      input.value = state.meta[key] === undefined || state.meta[key] === null ? "" : state.meta[key];
      input.addEventListener("input", function () {
        state.meta[key] = input.value;
        if (key === "quoteDate") refreshTerms();
        renderTotals(); renderPreview(); save();
      });
    });
    ["showCover", "showStrip", "showGallery", "showClosing", "showVideo"].forEach(function (key) {
      var box = doc.getElementById("qb-" + key);
      if (!box) return;
      box.checked = Boolean(state.meta[key]);
      box.addEventListener("change", function () { state.meta[key] = box.checked; renderPreview(); save(); });
    });
    var vat = doc.getElementById("qb-withVat");
    vat.checked = Boolean(state.meta.withVat);
    vat.addEventListener("change", function () {
      state.meta.withVat = vat.checked;
      refreshTerms(); renderTotals(); renderPreview(); save();
    });
    var terms = doc.getElementById("qb-terms");
    terms.value = (state.meta.terms || []).join("\n");
    terms.addEventListener("input", function () {
      state.meta.terms = terms.value.split("\n").filter(function (l) { return l.trim(); });
      renderPreview(); save();
    });
  }

  /* ---------- picking photos ---------- */
  var MULTI = {
    strip: { pick: "qb-strip-pick", flag: "showStrip", max: 3, word: "לרצועה", off: "ירדה מהרצועה", full: "ברצועה" },
    gallery: { pick: "qb-gallery-pick", flag: "showGallery", max: 6, word: "לעמוד התמונות", off: "ירדה מעמוד התמונות", full: "בעמוד התמונות" },
    collage: { pick: "qb-collage-pick", flag: "showClosing", max: 5, word: "לקולאז\u05f3", off: "ירדה מהקולאז\u05f3", full: "בקולאז\u05f3" }
  };

  function photoList() { return ((state.catalogue.media || {}).photos) || []; }

  function renderPickers() {
    var base = global.PADEL_BASE || "";

    var cover = doc.getElementById("qb-cover-pick");
    if (cover) {
      cover.replaceChildren();
      photoList().forEach(function (ph) {
        var b = el("button", "qb-thumb");
        b.type = "button";
        b.title = ph.caption || "";
        b.dataset.src = ph.src;
        var img = doc.createElement("img");
        img.src = base + ph.src; img.alt = ph.caption || ""; img.loading = "lazy";
        b.appendChild(img);
        b.appendChild(el("span", "qb-thumb-cap", ph.caption || ""));
        b.addEventListener("click", function () {
          state.meta.coverSrc = ph.src;
          state.meta.showCover = true;
          var box = doc.getElementById("qb-showCover");
          if (box) box.checked = true;
          markPickers(); renderPreview(); save();
          toast("תמונת הפתיחה: " + (ph.caption || ""));
        });
        cover.appendChild(b);
      });
    }

    Object.keys(MULTI).forEach(function (key) {
      var cfg = MULTI[key];
      var box = doc.getElementById(cfg.pick);
      if (!box) return;
      box.replaceChildren();
      photoList().forEach(function (ph) {
        var b = el("button", "qb-thumb");
        b.type = "button";
        b.title = ph.caption || "";
        b.dataset.src = ph.src;
        var img = doc.createElement("img");
        img.src = base + ph.src; img.alt = ph.caption || ""; img.loading = "lazy";
        b.appendChild(img);
        b.appendChild(el("i", "qb-thumb-n"));
        b.appendChild(el("span", "qb-thumb-cap", ph.caption || ""));
        b.addEventListener("click", function () { toggleMulti(key, ph); });
        box.appendChild(b);
      });
    });
    markPickers();
  }

  function syncFlag(flag) {
    var box = doc.getElementById("qb-" + flag);
    if (box) box.checked = Boolean(state.meta[flag]);
  }

  function toggleMulti(key, ph) {
    var cfg = MULTI[key];
    var list = state.meta[key] || (state.meta[key] = []);
    var i = list.indexOf(ph.src);
    if (i > -1) {
      list.splice(i, 1);
      markPickers(); renderPreview(); save();
      toast(cfg.off + ": " + (ph.caption || ""), "החזרה", function () {
        list.splice(Math.min(i, list.length), 0, ph.src);
        markPickers(); renderPreview(); save();
      });
      return;
    }
    if (list.length >= cfg.max) { toast(cfg.full + " אפשר עד " + cfg.max + " תמונות. תורידו אחת קודם."); return; }
    list.push(ph.src);
    state.meta[cfg.flag] = true;
    syncFlag(cfg.flag);
    markPickers(); renderPreview(); save();
    var extra = (key === "collage" && list.length === 1) ? ", והיא הגדולה" : "";
    toast("נוספה " + cfg.word + ": " + (ph.caption || "") + extra, "ביטול", function () {
      var at = list.indexOf(ph.src);
      if (at > -1) list.splice(at, 1);
      markPickers(); renderPreview(); save();
    });
  }

  function spreadAll() {
    var all = photoList().map(function (ph) { return ph.src; });
    if (!all.length) return;
    var before = {
      coverSrc: state.meta.coverSrc,
      strip: (state.meta.strip || []).slice(),
      gallery: (state.meta.gallery || []).slice(),
      collage: (state.meta.collage || []).slice()
    };
    var i = 0;
    function take(n) { var out = []; while (out.length < n && i < all.length) { out.push(all[i++]); } return out; }
    state.meta.coverSrc = take(1)[0] || "";
    state.meta.strip = take(MULTI.strip.max);
    state.meta.collage = take(MULTI.collage.max);
    state.meta.gallery = take(MULTI.gallery.max);
    ["showCover", "showStrip", "showGallery", "showClosing"].forEach(function (flag) {
      state.meta[flag] = true;
      syncFlag(flag);
    });
    markPickers(); renderPreview(); save();
    toast(all.length + " תמונות התפזרו על ארבעת העמודים.", "החזרה", function () {
      state.meta.coverSrc = before.coverSrc;
      state.meta.strip = before.strip;
      state.meta.gallery = before.gallery;
      state.meta.collage = before.collage;
      markPickers(); renderPreview(); save();
    });
  }

  function markPickers() {
    Array.prototype.forEach.call(doc.querySelectorAll("#qb-cover-pick .qb-thumb"), function (b) {
      b.classList.toggle("is-on", b.dataset.src === state.meta.coverSrc);
    });
    Object.keys(MULTI).forEach(function (key) {
      var list = state.meta[key] || [];
      Array.prototype.forEach.call(doc.querySelectorAll("#" + MULTI[key].pick + " .qb-thumb"), function (b) {
        var at = list.indexOf(b.dataset.src);
        var big = key === "collage" && at === 0;
        b.classList.toggle("is-on", at > -1);
        b.classList.toggle("is-big", big);
        var n = b.querySelector(".qb-thumb-n");
        if (n) n.textContent = at > -1 ? (big ? "גדולה" : String(at + 1)) : "";
      });
    });
  }

  function refreshTerms() {
    var terms = doc.getElementById("qb-terms");
    var filled = (state.catalogue.terms || []).map(function (line) {
      return line.replace("{validity}", String(state.catalogue.validityDays));
    }).filter(function (line) {
      return state.meta.withVat ? line.indexOf("אינם כוללים מע") === -1 : true;
    });
    if (!state.meta.terms || !state.meta.terms.length) {
      state.meta.terms = filled;
      terms.value = filled.join("\n");
    }
  }

  function freshMeta() {
    var media = state.catalogue.media || {};
    return {
      quoteDate: today(),
      withVat: false,
      intro: state.catalogue.intro,
      outro: state.catalogue.outro || "",
      terms: [],
      showCover: true,
      showStrip: true,
      showGallery: true,
      showClosing: true,
      showVideo: true,
      coverSrc: media.cover || "",
      strip: (media.strip || []).slice(),
      gallery: (media.gallery || []).slice(),
      collage: (media.collage || []).slice()
    };
  }

  /* ---------- quotes kept in this browser ---------- */
  function savedAll() {
    try {
      var list = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function savedWrite(list) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch (e) { /* private window */ }
  }
  function hasContent() {
    return Boolean(state.lines.length || (state.meta.client || "").trim() || (state.meta.title || "").trim());
  }
  function quoteName(meta) {
    var m = meta || state.meta;
    return (m.client || "").trim() || (m.title || "").trim() || ("הצעה מ" + he(m.quoteDate || today()));
  }
  function newId() { return "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function saveCurrent(quiet) {
    if (!hasContent()) {
      if (!quiet) toast("אין עדיין מה לשמור. תוסיפו סעיף או שם לקוח.");
      return null;
    }
    var list = savedAll();
    var rec = {
      id: state.currentId || newId(),
      name: quoteName(),
      client: state.meta.client || "",
      total: totals().total,
      updated: new Date().toISOString(),
      meta: clone(state.meta),
      lines: clone(state.lines)
    };
    var at = -1;
    list.forEach(function (r, i) { if (r.id === rec.id) at = i; });
    if (at > -1) list[at] = rec; else list.unshift(rec);
    savedWrite(list);
    state.currentId = rec.id;
    save(); state.dirty = false;
    renderSaved();
    if (!quiet) toast(at > -1 ? "ההצעה עודכנה: " + rec.name : "ההצעה נשמרה: " + rec.name);
    return rec;
  }

  function recById(id) {
    var found = null;
    savedAll().forEach(function (r) { if (r.id === id) found = r; });
    return found;
  }

  function openQuote(id) {
    var rec = recById(id);
    if (!rec) return;
    state.meta = Object.assign(freshMeta(), rec.meta);
    state.lines = (rec.lines || []).map(function (l) { return Object.assign({}, l); });
    state.currentId = rec.id;
    bindMeta(); renderPickers(); renderLines();
    save(); state.dirty = false;
    renderSaved();
    toast("נפתחה: " + rec.name);
    doc.getElementById("qp").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function duplicateQuote(id) {
    var rec = recById(id);
    if (!rec) return;
    var copy = clone(rec);
    copy.id = newId();
    copy.name = rec.name + " (עותק)";
    copy.updated = new Date().toISOString();
    var list = savedAll();
    list.unshift(copy);
    savedWrite(list);
    renderSaved();
    toast("נוצר עותק: " + copy.name, "פתיחה", function () { openQuote(copy.id); });
  }

  function deleteQuote(id) {
    var list = savedAll();
    var at = -1;
    list.forEach(function (r, i) { if (r.id === id) at = i; });
    if (at < 0) return;
    var rec = list[at];
    list.splice(at, 1);
    savedWrite(list);
    if (state.currentId === id) state.currentId = null;
    renderSaved();
    toast("נמחקה: " + rec.name, "החזרה", function () {
      var back = savedAll();
      back.splice(Math.min(at, back.length), 0, rec);
      savedWrite(back);
      renderSaved();
    });
  }

  function renderSaved() {
    var box = doc.getElementById("qb-saved");
    if (!box) return;
    var list = savedAll().sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });
    box.replaceChildren();
    if (!list.length) {
      box.appendChild(el("p", "qb-hint", "עוד לא נשמרה הצעה. כל הדפסה נשמרת כאן, ואפשר גם ללחוץ שמירה."));
      return;
    }
    list.forEach(function (r) {
      var row = el("div", "qb-saved-row" + (r.id === state.currentId ? " is-open" : ""));
      var text = el("div", "qb-saved-text");
      text.appendChild(el("b", null, r.name));
      var bits = [];
      if (r.total) bits.push(money(r.total) + " " + ((state.catalogue || {}).currency || "₪"));
      bits.push((r.lines || []).length + " סעיפים");
      bits.push("עודכן " + he(String(r.updated).slice(0, 10)));
      text.appendChild(el("span", "qb-saved-meta", bits.join(", ")));
      row.appendChild(text);

      var acts = el("div", "qb-saved-acts");
      var open = el("button", "btn btn-light qb-saved-btn", r.id === state.currentId ? "פתוחה" : "פתיחה");
      open.type = "button";
      open.disabled = r.id === state.currentId && !state.dirty;
      open.addEventListener("click", function () {
        guard({
          title: "לפתוח הצעה אחרת?",
          text: "ההצעה שעל המסך לא נשמרה. אפשר לשמור אותה לפני שעוברים אל " + r.name + ".",
          saveLabel: "לשמור ולפתוח"
        }, function () { openQuote(r.id); });
      });
      var dup = el("button", "btn btn-light qb-saved-btn", "שכפול");
      dup.type = "button";
      dup.addEventListener("click", function () { duplicateQuote(r.id); });
      var del = el("button", "btn btn-light qb-saved-btn qb-saved-del", "מחיקה");
      del.type = "button";
      del.addEventListener("click", function () { deleteQuote(r.id); });
      acts.appendChild(open); acts.appendChild(dup); acts.appendChild(del);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  /* ---------- the question before a quote leaves the screen ---------- */
  function askSwitch(opts) {
    var modal = doc.getElementById("qb-modal");
    if (!modal) { opts.proceed(); return; }
    var saveBtn = doc.getElementById("qb-modal-save");
    var skipBtn = doc.getElementById("qb-modal-skip");
    var cancelBtn = doc.getElementById("qb-modal-cancel");
    doc.getElementById("qb-modal-title").textContent = opts.title;
    doc.getElementById("qb-modal-text").textContent = opts.text;
    saveBtn.textContent = opts.saveLabel || "לשמור ולהמשיך";
    modal.hidden = false;

    function close() {
      modal.hidden = true;
      saveBtn.removeEventListener("click", onSave);
      skipBtn.removeEventListener("click", onSkip);
      cancelBtn.removeEventListener("click", close);
      modal.removeEventListener("click", onBackdrop);
      doc.removeEventListener("keydown", onKey);
    }
    function onSave() { saveCurrent(true); close(); opts.proceed(); }
    function onSkip() { close(); opts.proceed(); }
    function onBackdrop(e) { if (e.target === modal) close(); }
    function onKey(e) { if (e.key === "Escape") close(); }

    saveBtn.addEventListener("click", onSave);
    skipBtn.addEventListener("click", onSkip);
    cancelBtn.addEventListener("click", close);
    modal.addEventListener("click", onBackdrop);
    doc.addEventListener("keydown", onKey);
    saveBtn.focus();
  }

  function guard(opts, proceed) {
    if (!hasContent() || !state.dirty) { proceed(); return; }
    askSwitch({ title: opts.title, text: opts.text, saveLabel: opts.saveLabel, proceed: proceed });
  }

  function newQuote() {
    state.lines = [];
    state.meta = freshMeta();
    state.currentId = null;
    refreshTerms();
    bindMeta(); renderPickers(); renderLines();
    save(); state.dirty = false;
    renderSaved();
    toast("מסך נקי, אפשר להתחיל הצעה חדשה.");
  }

  function loadDemo() {
    var demo = state.catalogue.demo;
    if (!demo) return;
    var byId = {};
    state.catalogue.categories.forEach(function (cat) {
      cat.modules.forEach(function (mod) { byId[mod.id] = { cat: cat, mod: mod }; });
    });
    state.meta = Object.assign(freshMeta(), demo.meta, { quoteDate: today() });
    state.meta.terms = [];
    state.currentId = null;
    refreshTerms();
    state.lines = demo.lines.map(function (l) {
      var found = byId[l.id] || { cat: { label: "" }, mod: { title: l.id, desc: "", unit: "" } };
      return {
        uid: "l" + Math.random().toString(36).slice(2, 8),
        modId: l.id,
        category: found.cat.label,
        title: l.title || found.mod.title,
        desc: l.desc || found.mod.desc || "",
        unit: l.unit || found.mod.unit || "",
        qty: l.qty, price: l.price
      };
    });
    bindMeta(); renderPickers(); renderLines(); save();
    renderSaved();
    doc.getElementById("qp").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- buttons ---------- */
  function bindActions() {
    doc.getElementById("qb-print").addEventListener("click", function () {
      var rec = saveCurrent(true);
      if (rec) toast("ההצעה נשמרה ברשימה: " + rec.name);
      global.print();
    });

    doc.getElementById("qb-save").addEventListener("click", function () { saveCurrent(false); });

    var demoBtn = doc.getElementById("qb-demo");
    if (demoBtn) demoBtn.addEventListener("click", function () {
      guard({
        title: "להחליף בהצעה לדוגמה?",
        text: "ההצעה שעל המסך לא נשמרה, והיא תוחלף בהצעה המלאה לדוגמה.",
        saveLabel: "לשמור ולהחליף"
      }, loadDemo);
    });

    var spread = doc.getElementById("qb-spread");
    if (spread) spread.addEventListener("click", spreadAll);

    doc.getElementById("qb-clear").addEventListener("click", function () {
      guard({
        title: "להתחיל הצעה חדשה?",
        text: "ההצעה שעל המסך תרד מהמסך. אפשר לשמור אותה קודם ולחזור אליה מתי שרוצים.",
        saveLabel: "לשמור ולהתחיל חדשה"
      }, newQuote);
    });
  }

  /* ---------- start ---------- */
  fetch((global.PADEL_BASE || "") + "data/quote-modules.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.catalogue = data;
      var draft = load();
      state.meta = (draft && draft.meta) || freshMeta();
      state.lines = (draft && draft.lines) || [];
      if (!state.meta.quoteDate) state.meta.quoteDate = today();
      if (!state.meta.intro) state.meta.intro = data.intro;
      if (!state.meta.outro) state.meta.outro = data.outro || "";
      if (!state.meta.coverSrc) state.meta.coverSrc = (data.media || {}).cover || "";
      if (!state.meta.strip) state.meta.strip = ((data.media || {}).strip || []).slice();
      if (!state.meta.gallery) state.meta.gallery = ((data.media || {}).gallery || []).slice();
      if (!state.meta.collage) state.meta.collage = ((data.media || {}).collage || []).slice();
      state.currentId = (draft && draft.currentId) || null;
      refreshTerms();
      bindMeta();
      bindActions();
      renderSaved();
      renderPickers();
      renderCatalogue();
      renderLines();
      doc.getElementById("qp-validity").textContent =
        "ההצעה בתוקף עד " + he(addDays(state.meta.quoteDate || today(), data.validityDays));
      state.dirty = false;
    })
    .catch(function () {
      doc.getElementById("qb-catalogue").textContent = "הרכיבים לא נטענו. צריך לפתוח את הדף משרת, לא מהדיסק.";
    });
})(window, document);
