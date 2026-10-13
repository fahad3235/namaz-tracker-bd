"use strict";
/* Namaz Tracker BD - DOM app. Requires js/logic.js (window.NamazTracker).
   ?asof=YYYY-MM-DD overrides "today" for deterministic testing. */
(function () {
  var L = window.NamazTracker;
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function asofParam() {
    try {
      var p = new URLSearchParams(location.search).get("asof");
      if (p && L.isValidISODate(p)) return p;
    } catch (e) {}
    return L.todayISO();
  }
  var TODAY = asofParam();

  var loaded = L.loadState();
  var state = loaded.state;
  var lang = (state.settings && state.settings.lang) || "en";
  function t(k, ph) { return L.t(lang, k, ph); }
  function num(v) { return L.num(v, lang); }

  function persist() {
    state.settings.lang = lang;
    L.saveState(state);
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var box = qs("#toast");
    box.textContent = msg;
    box.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2600);
  }

  /* ---------- tabs ---------- */
  var activeTab = "today";
  var editingDate = null;      // history editor open for this date
  var confirmDeleteArmed = false;

  function switchTab(name) {
    activeTab = name;
    qsa("[data-tab]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
    ["today", "dashboard", "history", "data"].forEach(function (n) {
      qs("#tab-" + n).hidden = (n !== name);
    });
  }

  /* ---------- prayer card (today + history editor share this) ---------- */
  function prayerName(p) {
    var n = t("name_" + p);
    if (p === "dhuhr" && L.isFriday(editingDate || TODAY)) n += " (" + t("jummah") + ")";
    return n;
  }
  function buildCard(p, day) {
    var cur = (day && day[p]) || null;
    var card = el("div", "pcard");
    card.setAttribute("data-prayer", p);
    card.appendChild(el("div", "pname", prayerName(p)));
    var btns = el("div", "pbtns");
    [["done", t("prayed")], ["missed", t("missed")]].forEach(function (pair) {
      var b = el("button", "pbtn" + (cur === pair[0] ? " on-" + pair[0] : ""), pair[1]);
      b.type = "button";
      b.setAttribute("data-act", pair[0]);
      b.title = t("unmarkHint");
      b.addEventListener("click", function () {
        var next = (cur === pair[0]) ? null : pair[0]; // tap active again to unmark
        var r = L.setPrayer(state, editingDate || TODAY, p, next, TODAY);
        if (!r.ok) { toast(t(r.err)); return; }
        persist();
        renderAll();
      });
      btns.appendChild(b);
    });
    card.appendChild(btns);
    return card;
  }

  /* ---------- today tab ---------- */
  function renderToday() {
    var day = state.days[TODAY] || {};
    var wd = L.weekdayOf(TODAY);
    qs("#todayHeading").textContent = t("todayTitle") + " - " + t("wdf_" + wd) + ", " + num(TODAY);
    var done = L.dayDoneCount(day);
    qs("#progressText").textContent = L.xOfY(done, 5, lang);
    qs("#progressFill").style.width = (done / 5 * 100) + "%";
    var cards = qs("#prayerCards");
    cards.innerHTML = "";
    L.PRAYERS.forEach(function (p) { cards.appendChild(buildCard(p, day)); });

    qs("#qadaTitle").textContent = t("qadaTitle");
    qs("#qadaExplainer").textContent = t("qadaExplainer");
    var rows = qs("#qadaRows");
    rows.innerHTML = "";
    var anyOwed = false;
    L.PRAYERS.forEach(function (p) {
      var c = state.qada[p] || 0;
      if (c > 0) anyOwed = true;
      var row = el("div", "qrow");
      row.setAttribute("data-prayer", p);
      row.appendChild(el("span", "qname", t("name_" + p)));
      row.appendChild(el("span", "qcount", num(c)));
      var b = el("button", "qmake", t("madeUpOne"));
      b.type = "button";
      b.disabled = (c === 0);
      b.addEventListener("click", function () {
        L.madeUpOne(state, p);
        persist();
        renderAll();
      });
      row.appendChild(b);
      rows.appendChild(row);
    });
    qs("#qadaEmpty").hidden = anyOwed;
    qs("#qadaEmpty").textContent = t("qadaEmpty");
    qs("#qadaTotal").textContent = t("totalOwed") + ": " + num(L.totalQada(state.qada));
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    var day = state.days[TODAY] || {};
    var done = L.dayDoneCount(day);
    qs("#dashHero").textContent = L.xOfY(done, 5, lang);
    qs("#dashHeroSub").textContent = t("todayTitle");

    var streak = L.fullDayStreak(state.days, TODAY);
    qs("#streakVal").textContent = num(t("daysCount", { n: streak }));
    qs("#streakRule").textContent = t("streakRule");

    var cw = qs("#consistRows");
    cw.innerHTML = "";
    L.PRAYERS.forEach(function (p) {
      var c = L.consistency30(state.days, p, TODAY);
      var row = el("div", "crow");
      row.setAttribute("data-prayer", p);
      row.appendChild(el("span", "cname", t("name_" + p)));
      var track = el("div", "ctrack");
      var fill = el("div", "cfill");
      fill.style.width = (c.pct === null ? 0 : c.pct) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("span", "cpct", c.pct === null ? t("consistencyNone") : L.pctStr(c.pct, lang)));
      cw.appendChild(row);
    });

    var wg = qs("#weekGrid");
    wg.innerHTML = "";
    L.weeklyGrid(state.days, TODAY).forEach(function (cell) {
      var wd = L.weekdayOf(cell.date);
      var c = el("div", "wcell" + (cell.date === TODAY ? " wtoday" : ""));
      c.appendChild(el("div", "wwd", t("wd_" + wd)));
      var dots = el("div", "wdots");
      for (var i = 0; i < 5; i++) {
        dots.appendChild(el("span", "wdot" + (i < cell.done ? " on" : "")));
      }
      c.appendChild(dots);
      c.appendChild(el("div", "wxy", L.xOfY(cell.done, 5, lang)));
      c.title = cell.date;
      wg.appendChild(c);
    });

    var svg = qs("#trendSvg");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 600, H = 120, PAD = 4;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var data = L.trend30(state.days, TODAY);
    var bw = (W - PAD * 2) / data.length;
    data.forEach(function (cell, i) {
      var h = (cell.done / 5) * (H - PAD * 2);
      var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", (PAD + i * bw + 1).toFixed(1));
      r.setAttribute("y", (H - PAD - h).toFixed(1));
      r.setAttribute("width", Math.max(1, bw - 2).toFixed(1));
      r.setAttribute("height", Math.max(h, cell.done > 0 ? 2 : 0).toFixed(1));
      r.setAttribute("class", "tbar" + (cell.date === TODAY ? " ttoday" : ""));
      var ttl = document.createElementNS("http://www.w3.org/2000/svg", "title");
      ttl.textContent = cell.date + ": " + cell.done + "/5";
      r.appendChild(ttl);
      svg.appendChild(r);
    });
    qs("#dashConsistencyTitle").textContent = t("consistencyTitle", { n: num(30) });
    qs("#dashWeeklyTitle").textContent = t("weeklyTitle", { n: num(7) });
    qs("#dashTrendTitle").textContent = t("trendTitle", { n: num(30) });
    qs("#dashStreakTitle").textContent = t("streakTitle");
  }

  /* ---------- history ---------- */
  function dotRow(day) {
    var wrap = el("span", "dots");
    L.PRAYERS.forEach(function (p) {
      var st = (day && day[p]) || null;
      wrap.appendChild(el("span", "dot" + (st === "done" ? " d" : st === "missed" ? " m" : "")));
    });
    return wrap;
  }

  function renderHistory() {
    qs("#histTitle").textContent = t("historyTitle", { n: num(30) });
    qs("#jumpLabel").textContent = t("jumpLabel");
    qs("#jumpBtn").textContent = t("jumpBtn");
    var list = qs("#histList");
    list.innerHTML = "";
    var keys = L.historyKeys(state.days, TODAY);
    qs("#histEmpty").hidden = keys.length > 0;
    qs("#histEmpty").textContent = t("historyEmpty");
    keys.forEach(function (d) {
      var b = el("button", "hrow");
      b.type = "button";
      b.setAttribute("data-date", d);
      var wd = L.weekdayOf(d);
      var label = t("wd_" + wd) + " " + num(d) + (d === TODAY ? " - " + t("todayWord") : "");
      b.appendChild(el("span", "hdate", label));
      b.appendChild(dotRow(state.days[d]));
      b.addEventListener("click", function () { openEditor(d); });
      list.appendChild(b);
    });
    renderEditor();
  }

  function openEditor(d) {
    editingDate = d;
    confirmDeleteArmed = false;
    renderEditor();
    qs("#editor").scrollIntoView({ block: "nearest" });
  }
  function closeEditor() {
    editingDate = null;
    confirmDeleteArmed = false;
    renderEditor();
  }

  function renderEditor() {
    var box = qs("#editor");
    box.hidden = (editingDate === null);
    if (editingDate === null) return;
    qs("#edTitle").textContent = t("editTitle", { date: num(editingDate) });
    var tg = qs("#edToggles");
    tg.innerHTML = "";
    var day = state.days[editingDate] || {};
    L.PRAYERS.forEach(function (p) { tg.appendChild(buildCard(p, day)); });
    var del = qs("#edDelete");
    del.textContent = confirmDeleteArmed ? t("confirmDeleteEntry") : t("deleteEntry");
    del.classList.toggle("armed", confirmDeleteArmed);
    qs("#edClose").textContent = t("closeEditor");
    qs("#edLegend").innerHTML = "";
    [["d", t("legendDone")], ["m", t("legendMissed")], ["", t("legendNone")]].forEach(function (pair) {
      var s = el("span", "leg");
      s.appendChild(el("span", "dot" + (pair[0] ? " " + pair[0] : "")));
      s.appendChild(el("span", null, " " + pair[1]));
      qs("#edLegend").appendChild(s);
    });
  }

  /* ---------- data tab ---------- */
  function renderDataStatic() {
    qs("#dataExplainer").textContent = t("dataExplainer");
    qs("#expBtn").textContent = t("exportBtn");
    qs("#impBtn").textContent = t("importBtn");
    qs("#impLabel").textContent = t("importBtn");
    qs("#impText").placeholder = t("importPlaceholder");
    qs("#clearTitle").textContent = t("clearAll");
    qs("#clearHelp").textContent = t("clearAllHelp");
    qs("#clearBtn").textContent = t("clearAll");
  }

  function doExport() {
    var json = L.exportJSON(state);
    window.__lastExport = json;
    try {
      var blob = new Blob([json], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "namaz-tracker-bd-" + TODAY + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 800);
    } catch (e) { /* headless/file: download may not fire; __lastExport still captured */ }
    return json;
  }
  function doImportText(text) {
    var r = L.importJSON(text, TODAY);
    var msg = qs("#dataMsg");
    if (!r.ok) {
      msg.hidden = false;
      msg.className = "msg err";
      msg.textContent = t("errImport", {
        reason: r.errors.map(function (e) { return t(e.key, e.ph); }).join("; ")
      });
      return false;
    }
    state = r.state;
    lang = state.settings.lang;
    persist();
    confirmDeleteArmed = false;
    editingDate = null;
    renderAll();
    msg.hidden = false;
    msg.className = "msg ok";
    msg.textContent = t("importOk");
    return true;
  }

  /* ---------- header / footer / full render ---------- */
  function renderChrome() {
    document.documentElement.lang = lang;
    document.title = t("appTitle");
    qs("#appTitle").textContent = t("appTitle");
    qs("#appTagline").textContent = t("appTagline");
    qs("#langBtn").textContent = lang === "en" ? "\u09ac\u09be\u0982\u09b2\u09be" : "EN";
    var tabs = { today: "tabToday", dashboard: "tabDashboard", history: "tabHistory", data: "tabData" };
    Object.keys(tabs).forEach(function (n) {
      qs('[data-tab="' + n + '"]').textContent = t(tabs[n]);
    });
    qs("#disclaimer").textContent = t("disclaimer");
  }

  function renderAll() {
    renderChrome();
    renderToday();
    renderDashboard();
    renderHistory();
    renderDataStatic();
    if (activeTab) switchTab(activeTab);
  }

  /* ---------- wire up ---------- */
  qsa("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
  });
  qs("#langBtn").addEventListener("click", function () {
    lang = (lang === "en") ? "bn" : "en";
    persist();
    renderAll();
  });
  qs("#jumpBtn").addEventListener("click", function () {
    var v = qs("#jumpDate").value.trim();
    var err = qs("#jumpErr");
    if (!L.isValidISODate(v)) { err.hidden = false; err.textContent = t("errDateInvalid"); return; }
    if (L.isFutureDate(v, TODAY)) { err.hidden = false; err.textContent = t("errDateFuture"); return; }
    err.hidden = true;
    openEditor(v);
  });
  qs("#edClose").addEventListener("click", closeEditor);
  qs("#edDelete").addEventListener("click", function () {
    if (!confirmDeleteArmed) { confirmDeleteArmed = true; renderEditor(); return; }
    L.clearDay(state, editingDate, TODAY);
    persist();
    var d = editingDate;
    closeEditor();
    renderAll();
    toast(t("entryCleared"));
  });
  qs("#expBtn").addEventListener("click", doExport);
  qs("#impBtn").addEventListener("click", function () {
    doImportText(qs("#impText").value);
  });
  qs("#clearInput").addEventListener("input", function () {
    qs("#clearBtn").disabled = (qs("#clearInput").value !== "DELETE");
  });
  qs("#clearBtn").addEventListener("click", function () {
    if (qs("#clearInput").value !== "DELETE") return;
    var keepLang = lang;
    state = L.blankState();
    lang = keepLang;
    persist();
    editingDate = null;
    confirmDeleteArmed = false;
    qs("#clearInput").value = "";
    qs("#clearBtn").disabled = true;
    renderAll();
    toast(t("allCleared"));
  });

  // smoke-test hooks
  window.__nt = {
    today: function () { return TODAY; },
    lang: function () { return lang; },
    state: function () { return state; }
  };
  window.__importText = doImportText;
  window.__exportText = doExport;

  if (loaded.corrupt) {
    renderAll();
    toast(t("corruptNotice"));
  } else {
    renderAll();
  }
})();
