"use strict";
// Node unit tests for namaz-tracker-bd js/logic.js. Pure ASCII sources.
const M = require("../js/logic.js");

let pass = 0, fail = 0;
const failures = [];
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) { pass++; }
  else { fail++; failures.push(msg + " | got " + sa + " want " + sb); }
}
function ok(c, msg) {
  if (c) { pass++; } else { fail++; failures.push(msg); }
}

// localStorage stub
global.localStorage = {
  _s: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem(k, v) { this._s[k] = String(v); },
  removeItem(k) { delete this._s[k]; },
  clear() { this._s = {}; }
};

const A = "2026-10-13"; // "today" for tests (a Tuesday)

/* ---------- dates ---------- */
ok(/^\d{4}-\d{2}-\d{2}$/.test(M.todayISO()), "todayISO format");
eq(M.isValidISODate("2026-10-13"), true, "valid ISO");
eq(M.isValidISODate("2024-02-29"), true, "leap day valid");
eq(M.isValidISODate("2023-02-29"), false, "non-leap Feb29 invalid");
eq(M.isValidISODate("2026-13-01"), false, "month 13 invalid");
eq(M.isValidISODate("2026-10-32"), false, "day 32 invalid");
eq(M.isValidISODate("abc"), false, "garbage invalid");
eq(M.isValidISODate("2026-1-5"), false, "non-padded invalid");
eq(M.isFutureDate("2026-10-14", A), true, "future detected");
eq(M.isFutureDate("2026-10-13", A), false, "same day not future");
eq(M.addDaysISO("2026-10-13", -1), "2026-10-12", "addDays -1");
eq(M.addDaysISO("2026-10-01", -1), "2026-09-30", "addDays month boundary");
eq(M.addDaysISO("2026-01-01", -1), "2025-12-31", "addDays year boundary");
eq(M.addDaysISO("2026-10-13", 30), "2026-11-12", "addDays +30");
eq(M.weekdayOf("2026-10-13"), 2, "2026-10-13 is Tuesday");
eq(M.weekdayOf("2026-10-16"), 5, "2026-10-16 is Friday");
eq(M.isFriday("2026-10-16"), true, "isFriday true");
eq(M.isFriday("2026-10-13"), false, "isFriday false");

/* ---------- digits ---------- */
eq(M.bnDigits("0123456789"), "\u09E6\u09E7\u09E8\u09E9\u09EA\u09EB\u09EC\u09ED\u09EE\u09EF", "bnDigits 0-9");
eq(M.bnDigits("3/5"), "\u09E9/\u09EB", "bnDigits 3/5");
eq(M.num(5, "en"), "5", "num en");
eq(M.num(5, "bn"), "\u09EB", "num bn");
eq(M.xOfY(3, 5, "bn"), "\u09E9/\u09EB", "xOfY bn");
eq(M.xOfY(3, 5, "en"), "3/5", "xOfY en");
eq(M.pctStr(75, "bn"), "\u09ED\u09EB%", "pctStr bn");

/* ---------- blank state ---------- */
(function () {
  const st = M.blankState();
  eq(st.days, {}, "blank days");
  eq(st.qada, { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, "blank qada");
  eq(st.settings, { lang: "en" }, "blank settings");
})();

/* ---------- setPrayer + qada delta rules ---------- */
(function () {
  const st = M.blankState();
  let r = M.setPrayer(st, A, "fajr", "done", A);
  eq(r.ok, true, "set done ok");
  eq(st.days[A].fajr, "done", "fajr done stored");
  eq(st.qada.fajr, 0, "done does not touch qada");
  // toggle to same value: no-op
  r = M.setPrayer(st, A, "fajr", "done", A);
  eq(r.changed, false, "same status no-op");
  // done -> missed: qada +1
  r = M.setPrayer(st, A, "fajr", "missed", A);
  eq(r.changed, true, "done->missed changed");
  eq(st.qada.fajr, 1, "done->missed qada +1");
  // missed -> missed again: no double count
  M.setPrayer(st, A, "fajr", "missed", A);
  eq(st.qada.fajr, 1, "repeat missed no double count");
  // missed -> done: qada -1
  M.setPrayer(st, A, "fajr", "done", A);
  eq(st.qada.fajr, 0, "missed->done qada -1");
  // missed -> null (unmark): qada -1
  M.setPrayer(st, A, "dhuhr", "missed", A);
  eq(st.qada.dhuhr, 1, "missed adds qada");
  M.setPrayer(st, A, "dhuhr", null, A);
  eq(st.qada.dhuhr, 0, "missed->null qada -1");
  eq(st.days[A].dhuhr, null, "null stored");
  // null -> done: no qada change
  M.setPrayer(st, A, "asr", "done", A);
  eq(st.qada.asr, 0, "null->done no qada change");
  // clearing all five removes the day
  ["fajr", "asr"].forEach(p => M.setPrayer(st, A, p, null, A));
  eq(st.days[A], undefined, "empty day removed");
  // validation
  eq(M.setPrayer(st, "2026-02-30", "fajr", "done", A).err, "errDateInvalid", "invalid date rejected");
  eq(M.setPrayer(st, "2026-10-14", "fajr", "done", A).err, "errDateFuture", "future date rejected");
  eq(M.setPrayer(st, A, "tahajjud", "done", A).err, "errPrayerUnknown", "unknown prayer rejected");
  eq(M.setPrayer(st, A, "fajr", "yes", A).err, "errStatusBad", "bad status rejected");
  eq(M.setPrayer(st, "nope", "fajr", "done", A).err, "errDateInvalid", "garbage date rejected");
})();

/* ---------- madeUpOne floor ---------- */
(function () {
  const st = M.blankState();
  st.qada.fajr = 2;
  eq(M.madeUpOne(st, "fajr").value, 1, "made up decrements");
  eq(M.madeUpOne(st, "fajr").value, 0, "made up to zero");
  eq(M.madeUpOne(st, "fajr").value, 0, "floor at zero");
  eq(M.madeUpOne(st, "tahajjud").ok, false, "unknown prayer fails");
})();

/* ---------- day math ---------- */
(function () {
  const st = M.blankState();
  M.setPrayer(st, A, "fajr", "done", A);
  M.setPrayer(st, A, "dhuhr", "missed", A);
  eq(M.dayDoneCount(st.days[A]), 1, "dayDoneCount 1");
  eq(M.isFullDay(st.days[A]), false, "partial not full");
  ["dhuhr", "asr", "maghrib", "isha"].forEach(p => M.setPrayer(st, A, p, "done", A));
  eq(M.dayDoneCount(st.days[A]), 5, "dayDoneCount 5");
  eq(M.isFullDay(st.days[A]), true, "all done is full");
  eq(M.isFullDay(undefined), false, "missing day not full");
  eq(M.totalQada(st.qada), 0, "totalQada 0");
  st.qada.asr = 3; st.qada.isha = 2;
  eq(M.totalQada(st.qada), 5, "totalQada 5");
})();

/* ---------- hand-verified full-day streak ----------
   Oct 10/11/12 full, Oct 13 (today) partial -> streak ends yesterday = 3. */
function fullDay(st, d) {
  ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach(p => M.setPrayer(st, d, p, "done", A));
}
(function () {
  const st = M.blankState();
  fullDay(st, "2026-10-10"); fullDay(st, "2026-10-11"); fullDay(st, "2026-10-12");
  M.setPrayer(st, A, "fajr", "done", A);
  M.setPrayer(st, A, "dhuhr", "done", A);
  M.setPrayer(st, A, "asr", "done", A);
  M.setPrayer(st, A, "maghrib", "missed", A);
  eq(M.fullDayStreak(st.days, A), 3, "streak 3: today partial, ends yesterday");
  // now complete today -> 4
  M.setPrayer(st, A, "maghrib", "done", A);
  M.setPrayer(st, A, "isha", "done", A);
  eq(M.fullDayStreak(st.days, A), 4, "streak 4: today full");
})();
(function () {
  // gap breaks the streak
  const st = M.blankState();
  fullDay(st, "2026-10-10"); fullDay(st, "2026-10-12"); // Oct 11 missing
  eq(M.fullDayStreak(st.days, A), 1, "streak 1 after gap");
})();
(function () {
  const st = M.blankState();
  eq(M.fullDayStreak(st.days, A), 0, "empty streak 0");
  fullDay(st, A);
  eq(M.fullDayStreak(st.days, A), 1, "today-only full streak 1");
})();
(function () {
  // today partial, yesterday not full -> 0
  const st = M.blankState();
  M.setPrayer(st, A, "fajr", "done", A);
  M.setPrayer(st, "2026-10-12", "fajr", "missed", A);
  eq(M.fullDayStreak(st.days, A), 0, "streak 0 when yesterday not full");
})();

/* ---------- per-prayer streak ---------- */
(function () {
  const st = M.blankState();
  ["2026-10-11", "2026-10-12", A].forEach(d => M.setPrayer(st, d, "fajr", "done", A));
  eq(M.prayerStreak(st.days, "fajr", A), 3, "fajr streak 3");
  M.setPrayer(st, "2026-10-12", "asr", "missed", A);
  M.setPrayer(st, A, "asr", "done", A);
  eq(M.prayerStreak(st.days, "asr", A), 1, "asr streak 1 (missed yesterday)");
  eq(M.prayerStreak(st.days, "isha", A), 0, "isha streak 0 (never marked)");
})();

/* ---------- hand-verified 30-day consistency ----------
   fajr: 3 done + 1 missed in last 30d -> 75%. */
(function () {
  const st = M.blankState();
  M.setPrayer(st, "2026-10-10", "fajr", "done", A);
  M.setPrayer(st, "2026-10-11", "fajr", "done", A);
  M.setPrayer(st, "2026-10-12", "fajr", "missed", A);
  M.setPrayer(st, A, "fajr", "done", A);
  M.setPrayer(st, "2026-09-01", "fajr", "missed", A); // outside window
  const c = M.consistency30(st.days, "fajr", A);
  eq(c, { done: 3, marked: 4, pct: 75 }, "fajr consistency 75%");
  eq(M.consistency30(st.days, "isha", A).pct, null, "never marked -> null");
  M.setPrayer(st, A, "isha", "missed", A);
  eq(M.consistency30(st.days, "isha", A).pct, 0, "all missed -> 0%");
})();

/* ---------- weekly grid / trend shapes ---------- */
(function () {
  const st = M.blankState();
  M.setPrayer(st, A, "fajr", "done", A);
  M.setPrayer(st, "2026-10-12", "fajr", "done", A);
  M.setPrayer(st, "2026-10-12", "dhuhr", "done", A);
  const wg = M.weeklyGrid(st.days, A);
  eq(wg.length, 7, "weekly 7 cells");
  eq(wg[0].date, "2026-10-07", "weekly starts 6 days back");
  eq(wg[6].date, A, "weekly ends today");
  eq(wg[6].done, 1, "today done=1");
  eq(wg[5].done, 2, "yesterday done=2");
  eq(wg[0].total, 5, "weekly total 5");
  const tr = M.trend30(st.days, A);
  eq(tr.length, 30, "trend 30 bars");
  eq(tr[0].date, "2026-09-14", "trend starts 29 days back");
  eq(tr[29].date, A, "trend ends today");
  const hk = M.historyKeys(st.days, A);
  eq(hk, [A, "2026-10-12"], "historyKeys newest-first");
})();

/* ---------- clearDay ---------- */
(function () {
  const st = M.blankState();
  M.setPrayer(st, A, "fajr", "done", A);
  eq(M.clearDay(st, A, A).ok, true, "clearDay ok");
  eq(st.days[A], undefined, "day removed");
  eq(M.clearDay(st, "2026-10-14", A).err, "errDateFuture", "clearDay future rejected");
})();

/* ---------- export / import ---------- */
(function () {
  const st = M.blankState();
  fullDay(st, "2026-10-12");
  M.setPrayer(st, A, "fajr", "missed", A);
  M.setPrayer(st, A, "dhuhr", "done", A);
  st.qada.fajr = 2;
  st.settings.lang = "bn";
  const json = M.exportJSON(st);
  const parsed = JSON.parse(json);
  eq(parsed.app, "namaz-tracker-bd", "export app id");
  eq(parsed.version, 1, "export version");
  const r = M.importJSON(json, A);
  eq(r.ok, true, "round-trip import ok");
  eq(r.state, st, "round-trip state exact");
  eq(r.state.settings.lang, "bn", "lang survives round-trip");

  const base = JSON.parse(json);
  const V = (mut) => {
    const c = JSON.parse(JSON.stringify(base));
    mut(c);
    return JSON.stringify(c);
  };
  const badCases = [
    ["not json", "this is not json", "impErrJson"],
    ["wrong app", V(c => { c.app = "other"; }), "impErrApp"],
    ["wrong version", V(c => { c.version = 2; }), "impErrVersion"],
    ["missing data", JSON.stringify({ app: "namaz-tracker-bd", version: 1 }), "impErrData"],
    ["days not object", V(c => { c.data.days = []; }), "impErrData"],
    ["bad date key", V(c => { c.data.days["2026-13-01"] = { fajr: "done" }; }), "impErrDayKey"],
    ["non-ISO date key", V(c => { c.data.days["yesterday"] = { fajr: "done" }; }), "impErrDayKey"],
    ["future day key", V(c => { c.data.days["2026-10-14"] = { fajr: "done" }; }), "impErrDayFuture"],
    ["unknown prayer", V(c => { c.data.days[A].tahajjud = "done"; }), "impErrPrayerKey"],
    ["bad status", V(c => { c.data.days[A].fajr = "yes"; }), "impErrStatus"],
    ["bad status type", V(c => { c.data.days[A].fajr = 1; }), "impErrStatus"],
    ["negative qada", V(c => { c.data.qada.fajr = -1; }), "impErrQada"],
    ["float qada", V(c => { c.data.qada.fajr = 1.5; }), "impErrQada"],
    ["missing qada key", V(c => { delete c.data.qada.isha; }), "impErrQada"],
    ["bad lang", V(c => { c.data.settings.lang = "fr"; }), "impErrLang"],
    ["missing settings", V(c => { delete c.data.settings; }), "impErrLang"],
    ["null root", "null", "impErrData"],
    ["array root", "[]", "impErrData"]
  ];
  badCases.forEach(function ([name, text, wantKey]) {
    const rr = M.importJSON(text, A);
    eq(rr.ok, false, "malformed rejected: " + name);
    ok(rr.errors.length > 0 && rr.errors[0].key === wantKey, "error key " + wantKey + ": " + name);
  });
  // data intact: pure function - the caller's state object is never touched
  const before = JSON.stringify(st);
  M.importJSON("garbage", A);
  eq(JSON.stringify(st), before, "caller state untouched by failed import");
  eq(M.importJSON(json, A).ok, true, "valid import still ok after rejections");
})();

/* ---------- i18n parity ---------- */
(function () {
  const keys = M.i18nKeys();
  ok(keys.length > 40, "key count sane (" + keys.length + ")");
  let missing = 0, empty = 0, phMismatch = 0;
  keys.forEach(function (k) {
    const en = M.t("en", k), bn = M.t("bn", k);
    if (bn === k && en === k) missing++;
    if (!en || !bn) empty++;
    const ph = s => (s.match(/\{[a-z]+\}/g) || []).sort().join(",");
    if (ph(en) !== ph(bn)) phMismatch++;
  });
  eq(missing, 0, "no missing keys");
  eq(empty, 0, "no empty values");
  eq(phMismatch, 0, "placeholder parity");
  eq(M.t("en", "noSuchKey"), "noSuchKey", "missing key falls back to key");
  eq(M.t("fr", "tabToday"), "Today", "unknown lang falls back to en");
  eq(M.t("bn", "name_fajr"), "\u09AB\u099C\u09B0", "bn fajr name");
  eq(M.t("en", "errImport", { reason: "x" }), "Import failed: x", "errImport placeholder");
})();

/* ---------- storage ---------- */
(function () {
  localStorage.clear();
  let r = M.loadState();
  eq(r.corrupt, false, "empty storage not corrupt");
  eq(r.state.days, {}, "empty storage blank");
  localStorage.setItem(M.STORAGE_KEY, "{not json");
  r = M.loadState();
  eq(r.corrupt, true, "garbage storage flagged corrupt");
  eq(r.state.days, {}, "corrupt storage resets blank");
  localStorage.setItem(M.STORAGE_KEY, JSON.stringify({ app: "namaz-tracker-bd", version: 1, data: { nope: 1 } }));
  r = M.loadState();
  eq(r.corrupt, true, "schema-invalid storage flagged corrupt");
  const st = M.blankState();
  fullDay(st, "2026-10-12");
  st.qada.asr = 4;
  ok(M.saveState(st), "saveState ok");
  r = M.loadState();
  eq(r.corrupt, false, "saved state loads clean");
  eq(r.state.qada.asr, 4, "saved qada reloads");
  eq(M.dayDoneCount(r.state.days["2026-10-12"]), 5, "saved day reloads");
  localStorage.clear();
})();

console.log("\n" + pass + " passed, " + fail + " failed");
if (failures.length) {
  console.log("FAILURES:");
  failures.forEach(f => console.log(" - " + f));
  process.exit(1);
}
