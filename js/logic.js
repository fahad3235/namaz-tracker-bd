"use strict";
/* Namaz Tracker BD - pure logic (no DOM). Works in browsers and Node.
   Data is keyed by ISO date strings (YYYY-MM-DD).
   Prayer status values: "done" | "missed" | null (null = not marked).
   Qada = make-up prayers owed; non-negative integers per prayer. */

var PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
var STORAGE_KEY = "namaz-tracker-bd-v1";
var APP_ID = "namaz-tracker-bd";
var EXPORT_VERSION = 1;
var HISTORY_DAYS = 30;
var WEEK_DAYS = 7;

var I18N = {
  en: {
    "appTitle": "Namaz Tracker BD",
    "appTagline": "Daily prayer tracking for Bangladesh, offline",
    "tabToday": "Today",
    "tabDashboard": "Dashboard",
    "tabHistory": "History",
    "tabData": "Data",
    "todayTitle": "Today's prayers",
    "todayWord": "Today",
    "prayed": "Prayed",
    "missed": "Missed",
    "unmarkHint": "Tap the active button again to unmark",
    "jummah": "Jummah",
    "qadaTitle": "Qada - make-up prayers",
    "qadaExplainer": "Marking a prayer Missed adds it to qada (prayers you owe). After you make it up, tap 'Made up one'.",
    "madeUpOne": "Made up one",
    "totalOwed": "Total owed",
    "qadaEmpty": "No qada owed.",
    "streakTitle": "Full-day streak",
    "streakRule": "Consecutive days ending today or yesterday with all 5 prayers done.",
    "daysCount": "{n} days",
    "consistencyTitle": "{n}-day consistency",
    "consistencyNone": "none",
    "weeklyTitle": "Last {n} days",
    "trendTitle": "{n}-day trend",
    "historyTitle": "History - last {n} days",
    "historyEmpty": "No entries yet. Mark today's prayers to start your history.",
    "jumpLabel": "Jump to date",
    "jumpBtn": "Open",
    "editTitle": "Edit {date}",
    "deleteEntry": "Delete entry",
    "confirmDeleteEntry": "Tap again to confirm - this clears the day.",
    "entryCleared": "Entry cleared.",
    "closeEditor": "Close",
    "dataExplainer": "Export downloads a JSON backup of all your data. Import restores it after strict validation - bad files are rejected and your data stays intact.",
    "exportBtn": "Export JSON",
    "importBtn": "Import JSON",
    "importPlaceholder": "Paste exported JSON here, then tap Import.",
    "importOk": "Import successful.",
    "errImport": "Import failed: {reason}",
    "clearAll": "Erase all data",
    "clearAllHelp": "Type DELETE to erase everything. This cannot be undone.",
    "allCleared": "All data erased.",
    "disclaimer": "A personal tracker for your prayers. Not a religious authority.",
    "legendDone": "Prayed",
    "legendMissed": "Missed",
    "legendNone": "Not marked",
    "corruptNotice": "Saved data was corrupted, so the app started fresh.",
    "errDateFuture": "Date cannot be in the future.",
    "errDateInvalid": "Date must be a valid YYYY-MM-DD date.",
    "errPrayerUnknown": "Unknown prayer.",
    "errStatusBad": "Invalid status.",
    "name_fajr": "Fajr",
    "name_dhuhr": "Dhuhr",
    "name_asr": "Asr",
    "name_maghrib": "Maghrib",
    "name_isha": "Isha",
    "wd_0": "Sun", "wd_1": "Mon", "wd_2": "Tue", "wd_3": "Wed",
    "wd_4": "Thu", "wd_5": "Fri", "wd_6": "Sat",
    "wdf_0": "Sunday", "wdf_1": "Monday", "wdf_2": "Tuesday",
    "wdf_3": "Wednesday", "wdf_4": "Thursday", "wdf_5": "Friday",
    "wdf_6": "Saturday",
    "impErrJson": "Not valid JSON.",
    "impErrApp": "Not a Namaz Tracker BD backup (wrong app id).",
    "impErrVersion": "Unsupported backup version.",
    "impErrData": "Backup is missing its data section.",
    "impErrDayKey": "Bad date key: {k}.",
    "impErrDayFuture": "Backup contains a future date: {k}.",
    "impErrPrayerKey": "Unknown prayer key: {k}.",
    "impErrStatus": "Bad status value for {k}.",
    "impErrQada": "Qada counts must be whole numbers of 0 or more.",
    "impErrLang": "Language must be 'en' or 'bn'."
  },
  bn: {
    "appTitle": "\u09a8\u09be\u09ae\u09be\u099c \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0 \u09ac\u09bf\u09a1\u09bf",
    "appTagline": "\u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u0985\u09ab\u09b2\u09be\u0987\u09a8 \u09a6\u09c8\u09a8\u09bf\u0995 \u09a8\u09be\u09ae\u09be\u099c \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0",
    "tabToday": "\u0986\u099c",
    "tabDashboard": "\u09a1\u09cd\u09af\u09be\u09b6\u09ac\u09cb\u09b0\u09cd\u09a1",
    "tabHistory": "\u0987\u09a4\u09bf\u09b9\u09be\u09b8",
    "tabData": "\u09a1\u09c7\u099f\u09be",
    "todayTitle": "\u0986\u099c\u0995\u09c7\u09b0 \u09a8\u09be\u09ae\u09be\u099c",
    "todayWord": "\u0986\u099c",
    "prayed": "\u09aa\u09a1\u09bc\u09c7\u099b\u09bf",
    "missed": "\u099b\u09c1\u099f\u09c7 \u0997\u09c7\u099b\u09c7",
    "unmarkHint": "\u099a\u09bf\u09b9\u09cd\u09a8 \u09ae\u09c1\u099b\u09a4\u09c7 \u09b8\u0995\u09cd\u09b0\u09bf\u09af\u09bc \u09ac\u09cb\u09a4\u09be\u09ae\u09c7 \u0986\u09ac\u09be\u09b0 \u099a\u09be\u09aa\u09c1\u09a8",
    "jummah": "\u099c\u09c1\u09ae\u09cd\u09ae\u09be",
    "qadaTitle": "\u0995\u09be\u099c\u09be - \u09ac\u0995\u09c7\u09af\u09bc\u09be \u09a8\u09be\u09ae\u09be\u099c",
    "qadaExplainer": "'\u099b\u09c1\u099f\u09c7 \u0997\u09c7\u099b\u09c7' \u099a\u09bf\u09b9\u09cd\u09a8\u09bf\u09a4 \u0995\u09b0\u09b2\u09c7 \u09b8\u09c7\u0987 \u09a8\u09be\u09ae\u09be\u099c \u0995\u09be\u099c\u09be\u09af\u09bc \u09af\u09cb\u0997 \u09b9\u09af\u09bc (\u09ac\u0995\u09c7\u09af\u09bc\u09be \u09a8\u09be\u09ae\u09be\u099c)\u0964 \u09aa\u09b0\u09c7 \u09aa\u09a1\u09bc\u09c7 \u09a8\u09bf\u09b2\u09c7 '\u098f\u0995\u099f\u09bf \u0986\u09a6\u09be\u09af\u09bc \u0995\u09b0\u09b2\u09be\u09ae' \u099a\u09be\u09aa\u09c1\u09a8\u0964",
    "madeUpOne": "\u098f\u0995\u099f\u09bf \u0986\u09a6\u09be\u09af\u09bc \u0995\u09b0\u09b2\u09be\u09ae",
    "totalOwed": "\u09ae\u09cb\u099f \u09ac\u0995\u09c7\u09af\u09bc\u09be",
    "qadaEmpty": "\u0995\u09cb\u09a8\u09cb \u0995\u09be\u099c\u09be \u09ac\u0995\u09c7\u09af\u09bc\u09be \u09a8\u09c7\u0987\u0964",
    "streakTitle": "\u09aa\u09c2\u09b0\u09cd\u09a3-\u09a6\u09bf\u09a8\u09c7\u09b0 \u09a7\u09be\u09b0\u09be\u09ac\u09be\u09b9\u09bf\u0995\u09a4\u09be",
    "streakRule": "\u0986\u099c \u09ac\u09be \u0997\u09a4\u0995\u09be\u09b2 \u09a5\u09c7\u0995\u09c7 \u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09c7 \u099f\u09be\u09a8\u09be \u09af\u09a4 \u09a6\u09bf\u09a8 \u09eb \u0993\u09af\u09bc\u09be\u0995\u09cd\u09a4 \u09a8\u09be\u09ae\u09be\u099c\u0987 \u09aa\u09a1\u09bc\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    "daysCount": "{n} \u09a6\u09bf\u09a8",
    "consistencyTitle": "{n} \u09a6\u09bf\u09a8\u09c7\u09b0 \u09a7\u09be\u09b0\u09be\u09ac\u09be\u09b9\u09bf\u0995\u09a4\u09be",
    "consistencyNone": "\u09a8\u09c7\u0987",
    "weeklyTitle": "\u0997\u09a4 {n} \u09a6\u09bf\u09a8",
    "trendTitle": "{n} \u09a6\u09bf\u09a8\u09c7\u09b0 \u099f\u09cd\u09b0\u09c7\u09a8\u09cd\u09a1",
    "historyTitle": "\u0987\u09a4\u09bf\u09b9\u09be\u09b8 - \u0997\u09a4 {n} \u09a6\u09bf\u09a8",
    "historyEmpty": "\u098f\u0996\u09a8\u09cb \u0995\u09cb\u09a8\u09cb \u098f\u09a8\u09cd\u099f\u09cd\u09b0\u09bf \u09a8\u09c7\u0987\u0964 \u0986\u099c\u0995\u09c7\u09b0 \u09a8\u09be\u09ae\u09be\u099c \u099a\u09bf\u09b9\u09cd\u09a8\u09bf\u09a4 \u0995\u09b0\u09c7 \u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09c1\u09a8\u0964",
    "jumpLabel": "\u09a4\u09be\u09b0\u09bf\u0996\u09c7 \u09af\u09be\u09a8",
    "jumpBtn": "\u0996\u09c1\u09b2\u09c1\u09a8",
    "editTitle": "{date} \u09b8\u09ae\u09cd\u09aa\u09be\u09a6\u09a8\u09be \u0995\u09b0\u09c1\u09a8",
    "deleteEntry": "\u098f\u09a8\u09cd\u099f\u09cd\u09b0\u09bf \u09ae\u09c1\u099b\u09c1\u09a8",
    "confirmDeleteEntry": "\u09a8\u09bf\u09b6\u09cd\u099a\u09bf\u09a4 \u0995\u09b0\u09a4\u09c7 \u0986\u09ac\u09be\u09b0 \u099a\u09be\u09aa\u09c1\u09a8 - \u09a6\u09bf\u09a8\u099f\u09bf \u0996\u09be\u09b2\u09bf \u09b9\u09af\u09bc\u09c7 \u09af\u09be\u09ac\u09c7\u0964",
    "entryCleared": "\u098f\u09a8\u09cd\u099f\u09cd\u09b0\u09bf \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    "closeEditor": "\u09ac\u09a8\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8",
    "dataExplainer": "\u098f\u0995\u09cd\u09b8\u09aa\u09cb\u09b0\u09cd\u099f \u0995\u09b0\u09b2\u09c7 \u0986\u09aa\u09a8\u09be\u09b0 \u09b8\u09ac \u09a1\u09c7\u099f\u09be\u09b0 JSON \u09ac\u09cd\u09af\u09be\u0995\u0986\u09aa \u09a1\u09be\u0989\u09a8\u09b2\u09cb\u09a1 \u09b9\u09ac\u09c7\u0964 \u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f\u09c7\u09b0 \u09b8\u09ae\u09af\u09bc \u0995\u09a0\u09cb\u09b0 \u09af\u09be\u099a\u09be\u0987 \u0995\u09b0\u09be \u09b9\u09af\u09bc - \u09ad\u09c1\u09b2 \u09ab\u09be\u0987\u09b2 \u09ac\u09be\u09a4\u09bf\u09b2 \u09b9\u09ac\u09c7 \u098f\u09ac\u0982 \u0986\u09aa\u09a8\u09be\u09b0 \u09a1\u09c7\u099f\u09be \u0985\u0995\u09cd\u09b7\u09a4 \u09a5\u09be\u0995\u09ac\u09c7\u0964",
    "exportBtn": "JSON \u098f\u0995\u09cd\u09b8\u09aa\u09cb\u09b0\u09cd\u099f",
    "importBtn": "JSON \u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f",
    "importPlaceholder": "\u098f\u0995\u09cd\u09b8\u09aa\u09cb\u09b0\u09cd\u099f \u0995\u09b0\u09be JSON \u098f\u0996\u09be\u09a8\u09c7 \u09aa\u09c7\u09b8\u09cd\u099f \u0995\u09b0\u09c1\u09a8, \u09a4\u09be\u09b0\u09aa\u09b0 \u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f \u099a\u09be\u09aa\u09c1\u09a8\u0964",
    "importOk": "\u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f \u09b8\u09ab\u09b2 \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    "errImport": "\u0987\u09ae\u09aa\u09cb\u09b0\u09cd\u099f \u09ac\u09cd\u09af\u09b0\u09cd\u09a5: {reason}",
    "clearAll": "\u09b8\u09ac \u09a1\u09c7\u099f\u09be \u09ae\u09c1\u099b\u09c1\u09a8",
    "clearAllHelp": "\u09b8\u09ac\u0995\u09bf\u099b\u09c1 \u09ae\u09c1\u099b\u09a4\u09c7 DELETE \u09b2\u09bf\u0996\u09c1\u09a8\u0964 \u098f\u099f\u09bf \u0986\u09b0 \u09ab\u09c7\u09b0\u09be\u09a8\u09cb \u09af\u09be\u09ac\u09c7 \u09a8\u09be\u0964",
    "allCleared": "\u09b8\u09ac \u09a1\u09c7\u099f\u09be \u09ae\u09c1\u099b\u09c7 \u09ab\u09c7\u09b2\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    "disclaimer": "\u0986\u09aa\u09a8\u09be\u09b0 \u09a8\u09be\u09ae\u09be\u099c\u09c7\u09b0 \u09ac\u09cd\u09af\u0995\u09cd\u09a4\u09bf\u0997\u09a4 \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0\u0964 \u098f\u099f\u09bf \u0995\u09cb\u09a8\u09cb \u09a7\u09b0\u09cd\u09ae\u09c0\u09af\u09bc \u0995\u09b0\u09cd\u09a4\u09c3\u09aa\u0995\u09cd\u09b7 \u09a8\u09af\u09bc\u0964",
    "legendDone": "\u09aa\u09a1\u09bc\u09c7\u099b\u09bf",
    "legendMissed": "\u099b\u09c1\u099f\u09c7 \u0997\u09c7\u099b\u09c7",
    "legendNone": "\u099a\u09bf\u09b9\u09cd\u09a8\u09bf\u09a4 \u09a8\u09af\u09bc",
    "corruptNotice": "\u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09bf\u09a4 \u09a1\u09c7\u099f\u09be \u09a8\u09b7\u09cd\u099f \u099b\u09bf\u09b2, \u09a4\u09be\u0987 \u09a8\u09a4\u09c1\u09a8 \u0995\u09b0\u09c7 \u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09be \u09b9\u09af\u09bc\u09c7\u099b\u09c7\u0964",
    "errDateFuture": "\u09a4\u09be\u09b0\u09bf\u0996 \u09ad\u09ac\u09bf\u09b7\u09cd\u09af\u09a4\u09c7\u09b0 \u09b9\u09a4\u09c7 \u09aa\u09be\u09b0\u09ac\u09c7 \u09a8\u09be\u0964",
    "errDateInvalid": "\u09a4\u09be\u09b0\u09bf\u0996 \u0985\u09ac\u09b6\u09cd\u09af\u0987 \u09b8\u09a0\u09bf\u0995 YYYY-MM-DD \u09ab\u09b0\u09ae\u09cd\u09af\u09be\u099f\u09c7 \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    "errPrayerUnknown": "\u0985\u099c\u09be\u09a8\u09be \u09a8\u09be\u09ae\u09be\u099c\u0964",
    "errStatusBad": "\u0985\u09ac\u09c8\u09a7 \u0985\u09ac\u09b8\u09cd\u09a5\u09be\u0964",
    "name_fajr": "\u09ab\u099c\u09b0",
    "name_dhuhr": "\u09af\u09cb\u09b9\u09b0",
    "name_asr": "\u0986\u09b8\u09b0",
    "name_maghrib": "\u09ae\u09be\u0997\u09b0\u09bf\u09ac",
    "name_isha": "\u098f\u09b6\u09be",
    "wd_0": "\u09b0\u09ac\u09bf", "wd_1": "\u09b8\u09cb\u09ae", "wd_2": "\u09ae\u0999\u09cd\u0997\u09b2", "wd_3": "\u09ac\u09c1\u09a7",
    "wd_4": "\u09ac\u09c3\u09b9\u09b8\u09cd\u09aa\u09a4\u09bf", "wd_5": "\u09b6\u09c1\u0995\u09cd\u09b0", "wd_6": "\u09b6\u09a8\u09bf",
    "wdf_0": "\u09b0\u09ac\u09bf\u09ac\u09be\u09b0", "wdf_1": "\u09b8\u09cb\u09ae\u09ac\u09be\u09b0", "wdf_2": "\u09ae\u0999\u09cd\u0997\u09b2\u09ac\u09be\u09b0",
    "wdf_3": "\u09ac\u09c1\u09a7\u09ac\u09be\u09b0", "wdf_4": "\u09ac\u09c3\u09b9\u09b8\u09cd\u09aa\u09a4\u09bf\u09ac\u09be\u09b0", "wdf_5": "\u09b6\u09c1\u0995\u09cd\u09b0\u09ac\u09be\u09b0",
    "wdf_6": "\u09b6\u09a8\u09bf\u09ac\u09be\u09b0",
    "impErrJson": "\u09b8\u09a0\u09bf\u0995 JSON \u09a8\u09af\u09bc\u0964",
    "impErrApp": "\u098f\u099f\u09bf \u09a8\u09be\u09ae\u09be\u099c \u099f\u09cd\u09b0\u09cd\u09af\u09be\u0995\u09be\u09b0 \u09ac\u09bf\u09a1\u09bf\u09b0 \u09ac\u09cd\u09af\u09be\u0995\u0986\u09aa \u09a8\u09af\u09bc\u0964",
    "impErrVersion": "\u0985\u09b8\u09ae\u09b0\u09cd\u09a5\u09bf\u09a4 \u09ac\u09cd\u09af\u09be\u0995\u0986\u09aa \u09b8\u0982\u09b8\u09cd\u0995\u09b0\u09a3\u0964",
    "impErrData": "\u09ac\u09cd\u09af\u09be\u0995\u0986\u09aa\u09c7 \u09a1\u09c7\u099f\u09be \u0985\u0982\u09b6 \u09a8\u09c7\u0987\u0964",
    "impErrDayKey": "\u09ad\u09c1\u09b2 \u09a4\u09be\u09b0\u09bf\u0996: {k}\u0964",
    "impErrDayFuture": "\u09ac\u09cd\u09af\u09be\u0995\u0986\u09aa\u09c7 \u09ad\u09ac\u09bf\u09b7\u09cd\u09af\u09a4\u09c7\u09b0 \u09a4\u09be\u09b0\u09bf\u0996 \u0986\u099b\u09c7: {k}\u0964",
    "impErrLang": "\u09ad\u09be\u09b7\u09be 'en' \u09ac\u09be 'bn' \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    "impErrPrayerKey": "\u0985\u099c\u09be\u09a8\u09be \u09a8\u09be\u09ae\u09be\u099c: {k}\u0964",
    "impErrQada": "\u0995\u09be\u099c\u09be\u09b0 \u09b8\u0982\u0996\u09cd\u09af\u09be \u09e6 \u09ac\u09be \u09a4\u09be\u09b0 \u09ac\u09c7\u09b6\u09bf \u09aa\u09c2\u09b0\u09cd\u09a3\u09b8\u0982\u0996\u09cd\u09af\u09be \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964",
    "impErrStatus": "{k}-\u098f\u09b0 \u0985\u09ac\u09b8\u09cd\u09a5\u09be \u09ad\u09c1\u09b2\u0964"
  }
};

function t(lang, key, ph) {
  var dict = I18N[lang] || I18N.en;
  var s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key]
        : (Object.prototype.hasOwnProperty.call(I18N.en, key) ? I18N.en[key] : key);
  if (ph) {
    Object.keys(ph).forEach(function (k) {
      s = s.split("{" + k + "}").join(String(ph[k]));
    });
  }
  return s;
}
function i18nKeys() { return Object.keys(I18N.en); }

/* ---------- dates (UTC-based, deterministic) ---------- */
function todayISO() {
  var d = new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
}
function isValidISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split("-").map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function isFutureDate(iso, asof) { return iso > asof; } // ISO strings sort chronologically
function addDaysISO(iso, n) {
  var p = iso.split("-").map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(iso) {
  var p = iso.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); // 0=Sun..6=Sat
}
function isFriday(iso) { return weekdayOf(iso) === 5; }

/* ---------- digits ---------- */
var BN_DIGITS = ["\u09e6", "\u09e7", "\u09e8", "\u09e9", "\u09ea", "\u09eb", "\u09ec", "\u09ed", "\u09ee", "\u09ef"];
function bnDigits(s) { return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; }); }
function num(v, lang) { return lang === "bn" ? bnDigits(v) : String(v); }
function xOfY(done, total, lang) { return num(done + "/" + total, lang); }
function pctStr(p, lang) { return num(p + "%", lang); }

/* ---------- state ---------- */
function blankQada() {
  var q = {};
  PRAYERS.forEach(function (p) { q[p] = 0; });
  return q;
}
function blankState() {
  return { days: {}, qada: blankQada(), settings: { lang: "en" } };
}

/* Set one prayer's status for a date. Qada delta: ->missed adds 1,
   missed->anything-else removes 1 (floor 0). Toggling to the same
   status is a no-op. */
function setPrayer(state, dateISO, prayer, status, asof) {
  asof = asof || todayISO();
  if (!isValidISODate(dateISO)) return { ok: false, err: "errDateInvalid" };
  if (isFutureDate(dateISO, asof)) return { ok: false, err: "errDateFuture" };
  if (PRAYERS.indexOf(prayer) < 0) return { ok: false, err: "errPrayerUnknown" };
  if (status !== null && status !== "done" && status !== "missed") return { ok: false, err: "errStatusBad" };
  var day = state.days[dateISO] || {};
  var prev = day[prayer] || null;
  if (prev === status) return { ok: true, changed: false };
  var next = {}, any = false;
  PRAYERS.forEach(function (p) {
    next[p] = (p === prayer) ? status : (day[p] || null);
    if (next[p] !== null) any = true;
  });
  if (any) state.days[dateISO] = next; else delete state.days[dateISO];
  var wasMissed = (prev === "missed"), isMissed = (status === "missed");
  if (!wasMissed && isMissed) state.qada[prayer] += 1;
  else if (wasMissed && !isMissed) state.qada[prayer] = Math.max(0, state.qada[prayer] - 1);
  return { ok: true, changed: true };
}

/* Manually record making up one qada prayer. Floor at 0. */
function madeUpOne(state, prayer) {
  if (PRAYERS.indexOf(prayer) < 0) return { ok: false, err: "errPrayerUnknown" };
  state.qada[prayer] = Math.max(0, (state.qada[prayer] || 0) - 1);
  return { ok: true, value: state.qada[prayer] };
}

function totalQada(qada) {
  var n = 0;
  PRAYERS.forEach(function (p) { n += (qada[p] || 0); });
  return n;
}

/* Remove a whole day entry (= clearing it). */
function clearDay(state, dateISO, asof) {
  asof = asof || todayISO();
  if (!isValidISODate(dateISO)) return { ok: false, err: "errDateInvalid" };
  if (isFutureDate(dateISO, asof)) return { ok: false, err: "errDateFuture" };
  delete state.days[dateISO];
  return { ok: true };
}

/* ---------- day math ---------- */
function dayDoneCount(day) {
  var n = 0;
  PRAYERS.forEach(function (p) { if (day && day[p] === "done") n++; });
  return n;
}
function isFullDay(day) {
  if (!day) return false;
  return PRAYERS.every(function (p) { return day[p] === "done"; });
}

/* Full-day streak: consecutive days ending today-or-yesterday with all 5 done.
   If today is not a full day, the streak is counted back from yesterday. */
function fullDayStreak(days, asof) {
  var d = asof, n = 0;
  if (!isFullDay(days[d])) d = addDaysISO(d, -1);
  while (isFullDay(days[d])) { n++; d = addDaysISO(d, -1); }
  return n;
}

/* Per-prayer streak: consecutive days ending today-or-yesterday with that prayer done. */
function prayerStreak(days, prayer, asof) {
  var d = asof, n = 0;
  var day = days[d];
  if (!(day && day[prayer] === "done")) d = addDaysISO(d, -1);
  while (true) {
    var dd = days[d];
    if (!(dd && dd[prayer] === "done")) break;
    n++; d = addDaysISO(d, -1);
  }
  return n;
}

/* 30-day consistency for one prayer: done / (done+missed) over the last 30
   days ending asof. null when the prayer was never marked in the window. */
function consistency30(days, prayer, asof) {
  var done = 0, marked = 0;
  for (var i = 0; i < HISTORY_DAYS; i++) {
    var st = (days[addDaysISO(asof, -i)] || {})[prayer] || null;
    if (st === "done") { done++; marked++; }
    else if (st === "missed") { marked++; }
  }
  return { done: done, marked: marked, pct: marked ? Math.round(100 * done / marked) : null };
}

/* Weekly grid: last 7 days ending asof, oldest first. */
function weeklyGrid(days, asof) {
  var out = [];
  for (var i = WEEK_DAYS - 1; i >= 0; i--) {
    var d = addDaysISO(asof, -i);
    out.push({ date: d, done: dayDoneCount(days[d]), total: PRAYERS.length });
  }
  return out;
}

/* 30-day trend: last 30 days ending asof, oldest first. */
function trend30(days, asof) {
  var out = [];
  for (var i = HISTORY_DAYS - 1; i >= 0; i--) {
    var d = addDaysISO(asof, -i);
    out.push({ date: d, done: dayDoneCount(days[d]), total: PRAYERS.length });
  }
  return out;
}

/* Last 30 day-keys with any entry, newest first. */
function historyKeys(days, asof) {
  var out = [];
  for (var i = 0; i < HISTORY_DAYS; i++) {
    var d = addDaysISO(asof, -i);
    if (days[d]) out.push(d);
  }
  return out;
}

/* ---------- export / import ---------- */
function exportJSON(state) {
  return JSON.stringify({
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  }, null, 2);
}

function impErr(key, ph) { return { key: key, ph: ph || {} }; }
function validateImport(text, asof) {
  var errors = [];
  var parsed;
  try { parsed = JSON.parse(text); }
  catch (e) { return { ok: false, errors: [impErr("impErrJson")] }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errors: [impErr("impErrData")] };
  }
  if (parsed.app !== APP_ID) errors.push(impErr("impErrApp"));
  if (parsed.version !== EXPORT_VERSION) errors.push(impErr("impErrVersion"));
  var data = parsed.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) errors.push(impErr("impErrData"));
  var state = blankState();
  if (errors.length) return { ok: false, errors: errors };

  // days
  if (!data.days || typeof data.days !== "object" || Array.isArray(data.days)) {
    errors.push(impErr("impErrData"));
  } else {
    Object.keys(data.days).forEach(function (k) {
      if (!isValidISODate(k)) { errors.push(impErr("impErrDayKey", { k: k })); return; }
      if (asof && isFutureDate(k, asof)) { errors.push(impErr("impErrDayFuture", { k: k })); return; }
      var v = data.days[k];
      if (!v || typeof v !== "object" || Array.isArray(v)) { errors.push(impErr("impErrStatus", { k: k })); return; }
      Object.keys(v).forEach(function (pk) {
        if (PRAYERS.indexOf(pk) < 0) errors.push(impErr("impErrPrayerKey", { k: pk }));
        else if (v[pk] !== null && v[pk] !== "done" && v[pk] !== "missed") errors.push(impErr("impErrStatus", { k: pk }));
      });
    });
  }
  // qada
  if (!data.qada || typeof data.qada !== "object" || Array.isArray(data.qada)) {
    errors.push(impErr("impErrQada"));
  } else {
    PRAYERS.forEach(function (p) {
      var q = data.qada[p];
      if (!Number.isInteger(q) || q < 0) errors.push(impErr("impErrQada"));
    });
  }
  // settings
  if (!data.settings || typeof data.settings !== "object" || Array.isArray(data.settings)) {
    errors.push(impErr("impErrLang"));
  } else if (data.settings.lang !== "en" && data.settings.lang !== "bn") {
    errors.push(impErr("impErrLang"));
  }

  if (errors.length) {
    // dedupe by key while keeping order
    var seen = {}, deduped = [];
    errors.forEach(function (e) { if (!seen[e.key]) { seen[e.key] = 1; deduped.push(e); } });
    return { ok: false, errors: deduped };
  }
  PRAYERS.forEach(function (p) { state.qada[p] = data.qada[p]; });
  Object.keys(data.days).forEach(function (k) {
    var day = {}, any = false;
    PRAYERS.forEach(function (p) {
      var v = data.days[k][p];
      day[p] = (v === "done" || v === "missed") ? v : null;
      if (day[p] !== null) any = true;
    });
    if (any) state.days[k] = day;
  });
  state.settings.lang = data.settings.lang;
  return { ok: true, errors: [], state: state };
}
function importJSON(text, asof) { return validateImport(text, asof); }

/* ---------- storage ---------- */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, exportJSON(state));
    return true;
  } catch (e) { return false; }
}
function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { /* no storage */ }
  if (raw === null || raw === undefined || raw === "") {
    return { state: blankState(), corrupt: false };
  }
  var r = validateImport(raw, null); // no future-date check on load
  if (!r.ok) return { state: blankState(), corrupt: true };
  return { state: r.state, corrupt: false };
}

var API = {
  PRAYERS: PRAYERS, STORAGE_KEY: STORAGE_KEY, APP_ID: APP_ID,
  HISTORY_DAYS: HISTORY_DAYS, WEEK_DAYS: WEEK_DAYS,
  t: t, i18nKeys: i18nKeys,
  todayISO: todayISO, isValidISODate: isValidISODate,
  isFutureDate: isFutureDate, addDaysISO: addDaysISO,
  weekdayOf: weekdayOf, isFriday: isFriday,
  bnDigits: bnDigits, num: num, xOfY: xOfY, pctStr: pctStr,
  blankState: blankState,
  setPrayer: setPrayer, madeUpOne: madeUpOne, totalQada: totalQada,
  clearDay: clearDay,
  dayDoneCount: dayDoneCount, isFullDay: isFullDay,
  fullDayStreak: fullDayStreak, prayerStreak: prayerStreak,
  consistency30: consistency30, weeklyGrid: weeklyGrid,
  trend30: trend30, historyKeys: historyKeys,
  exportJSON: exportJSON, validateImport: validateImport, importJSON: importJSON,
  saveState: saveState, loadState: loadState
};

if (typeof module !== "undefined" && module.exports) module.exports = API;
if (typeof window !== "undefined") window.NamazTracker = API;
