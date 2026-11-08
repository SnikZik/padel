/**
 * Quote builder (Snir, 8.11.2026). A private screen, not linked from the site.
 *
 * Every line of a quote is a module from data/quote-modules.json: a title, a sentence that says what the client
 * gets, a unit, a quantity and a price. Inside a quote each of those is editable, so the catalogue is a starting
 * point. Nothing is invented: a module with no price shows an empty price field until someone types one.
 *
 * The result prints as an A4 page and copies as a WhatsApp message. Drafts live in this browser only
 * (localStorage), there is no server behind this.
 */
(function (global, doc) {
  "use strict";

  var DRAFT_KEY = "padel.quote.draft.v1";
  var state = { meta: {}, lines: [], catalogue: null };

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
        var b = el("button", "qb-chip", mod.title);
        b.type = "button";
        b.addEventListener("click", function () { addLine(cat, mod); });
        list.appendChild(b);
      });
      group.appendChild(list);
      box.appendChild(group);
    });
  }

  function addLine(cat, mod) {
    state.lines.push({
      uid: "l" + Date.now() + Math.random().toString(36).slice(2, 6),
      category: cat.label,
      title: mod.title,
      desc: mod.desc || "",
      unit: mod.unit || "",
      qty: mod.qty === null || mod.qty === undefined ? 1 : mod.qty,
      price: mod.price === null || mod.price === undefined ? "" : mod.price
    });
    renderLines();
    save();
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
      var del = el("button", "qb-icon qb-del", "✕");
      del.type = "button"; del.title = "מחיקת הסעיף"; del.setAttribute("aria-label", "מחיקת הסעיף");
      del.addEventListener("click", function () { state.lines.splice(i, 1); renderLines(); save(); });
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

  function quoteText() {
    var m = state.meta, c = state.catalogue, t = totals();
    var out = [];
    out.push(m.title || "הצעת מחיר לאירוע");
    out.push("The Padel Club Azor, ז׳בוטינסקי 28 אזור");
    if (m.client) out.push("לכבוד " + m.client);
    var facts = [];
    if (m.eventDate) facts.push("תאריך האירוע " + he(m.eventDate));
    if (m.hours) facts.push(m.hours);
    if (m.guests) facts.push(m.guests + " משתתפים");
    if (facts.length) out.push(facts.join(" · "));
    out.push("");
    if (m.intro) { out.push(m.intro); out.push(""); }
    state.lines.forEach(function (l) {
      var p = parseFloat(l.price), q = parseFloat(l.qty);
      var price = isNaN(p) || isNaN(q) ? "" : "  " + money(p * q) + " " + c.currency;
      out.push("• " + l.title + price);
      if (l.desc) out.push("  " + l.desc);
      if (!isNaN(q) && l.unit) out.push("  " + q + " " + l.unit + (isNaN(p) ? "" : " × " + money(p) + " " + c.currency));
    });
    out.push("");
    if (t.discount) out.push("הנחה " + money(t.discount) + " " + c.currency);
    out.push("סך הכול " + money(t.total) + " " + c.currency + (m.withVat ? " כולל מע\"מ" : " לפני מע\"מ"));
    out.push("");
    (m.terms || []).forEach(function (line) { out.push(line); });
    return out.join("\n");
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
    var hero = doc.getElementById("qp-hero");
    hero.hidden = !(m.showHero && media.hero);
    if (!hero.hidden) {
      var heroImg = doc.getElementById("qp-hero-img");
      heroImg.src = base + media.hero;
      heroImg.alt = "מתחם The Padel Club Azor";
    }
    var photos = doc.getElementById("qp-photos");
    photos.replaceChildren();
    photos.hidden = !(m.showPhotos && (media.photos || []).length);
    if (!photos.hidden) {
      media.photos.forEach(function (ph) {
        var li = el("li");
        var img = doc.createElement("img");
        img.src = base + ph.src;
        img.alt = ph.caption || "";
        li.appendChild(img);
        if (ph.caption) li.appendChild(el("span", null, ph.caption));
        photos.appendChild(li);
      });
    }
    var video = doc.getElementById("qp-video");
    video.hidden = !(m.showVideo && media.videoUrl);
    if (!video.hidden) video.textContent = "תמונות וסרטונים מאירועים אצלנו: " + media.videoUrl;

    var terms = doc.getElementById("qp-terms");
    terms.replaceChildren();
    (m.terms || []).forEach(function (line) { terms.appendChild(el("li", null, line)); });
  }

  /* ---------- draft ---------- */
  function save() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ meta: state.meta, lines: state.lines })); } catch (e) { /* private window */ }
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
    var fields = ["title", "client", "eventDate", "hours", "guests", "quoteDate", "discount", "intro"];
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
    ["showHero", "showPhotos", "showVideo"].forEach(function (key) {
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

  /* ---------- buttons ---------- */
  function bindActions() {
    doc.getElementById("qb-print").addEventListener("click", function () { global.print(); });
    doc.getElementById("qb-copy").addEventListener("click", function () {
      var text = quoteText();
      navigator.clipboard.writeText(text).then(function () {
        var b = doc.getElementById("qb-copy");
        var was = b.textContent;
        b.textContent = "הועתק";
        setTimeout(function () { b.textContent = was; }, 1600);
      });
    });
    doc.getElementById("qb-whatsapp").addEventListener("click", function () {
      global.open("https://wa.me/?text=" + encodeURIComponent(quoteText()), "_blank", "noopener");
    });
    var demoBtn = doc.getElementById("qb-demo");
    if (demoBtn) demoBtn.addEventListener("click", function () {
      var demo = state.catalogue.demo;
      if (!demo) return;
      if (state.lines.length && !global.confirm("להחליף את ההצעה הנוכחית בהצעה לדוגמה?")) return;
      var byId = {};
      state.catalogue.categories.forEach(function (cat) {
        cat.modules.forEach(function (mod) { byId[mod.id] = { cat: cat, mod: mod }; });
      });
      state.meta = Object.assign({ quoteDate: today(), terms: [], showHero: true, showPhotos: true, showVideo: true }, demo.meta);
      state.meta.terms = [];
      refreshTerms();
      state.lines = demo.lines.map(function (l) {
        var found = byId[l.id] || { cat: { label: "" }, mod: { title: l.id, desc: "", unit: "" } };
        return {
          uid: "l" + Math.random().toString(36).slice(2, 8),
          category: found.cat.label,
          title: l.title || found.mod.title,
          desc: l.desc || found.mod.desc || "",
          unit: l.unit || found.mod.unit || "",
          qty: l.qty, price: l.price
        };
      });
      bindMeta(); renderLines(); save();
      doc.getElementById("qp").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    doc.getElementById("qb-clear").addEventListener("click", function () {
      if (!global.confirm("לנקות את ההצעה ולהתחיל מחדש?")) return;
      state.lines = [];
      state.meta = { quoteDate: today(), withVat: false, intro: state.catalogue.intro, terms: [] };
      refreshTerms();
      bindMeta(); renderLines(); save();
    });
  }

  /* ---------- start ---------- */
  fetch((global.PADEL_BASE || "") + "data/quote-modules.json")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.catalogue = data;
      var draft = load();
      state.meta = (draft && draft.meta) || { quoteDate: today(), withVat: false, intro: data.intro, terms: [] };
      state.lines = (draft && draft.lines) || [];
      if (!state.meta.quoteDate) state.meta.quoteDate = today();
      if (!state.meta.intro) state.meta.intro = data.intro;
      refreshTerms();
      bindMeta();
      bindActions();
      renderCatalogue();
      renderLines();
      doc.getElementById("qp-validity").textContent =
        "ההצעה בתוקף עד " + he(addDays(state.meta.quoteDate || today(), data.validityDays));
    })
    .catch(function () {
      doc.getElementById("qb-catalogue").textContent = "הרכיבים לא נטענו. צריך לפתוח את הדף משרת, לא מהדיסק.";
    });
})(window, document);
