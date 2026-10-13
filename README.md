# Namaz Tracker BD

Offline bilingual (English / Bangla) daily prayer (namaz) tracker for
Bangladesh. Mark each of the 5 daily prayers as prayed or missed, track
qada (make-up prayers owed), build full-day streaks, and review 30 days of
history -- all offline, with zero network requests and no accounts.

**Status:** MVP complete. 142/142 node unit tests + 57/57 headless-Chrome
smoke checks green, 0 console/page errors. Ships EMPTY (no demo data).
A personal tracker for your prayers. Not a religious authority.

## Problem

Keeping a consistent prayer habit is hard without feedback: paper logs get
lost, phone notes are unstructured, and most tracker apps need accounts,
internet, or English-only interfaces. This app is a private, offline,
Bengali-friendly logbook: two taps a day, honest streaks, and a qada
counter so missed prayers are never forgotten.

## Features

- **Today** -- 5 prayer cards (Fajr, Dhuhr, Asr, Maghrib, Isha; Dhuhr is
  labeled "Dhuhr (Jummah)" on Fridays), each with Prayed / Missed buttons
  (tap the active button again to unmark). Live x/5 completion bar.
- **Qada counter** -- per-prayer owed counts plus a total. Marking Missed
  adds 1 to qada; changing Missed to Prayed (or unmarking) removes 1;
  "Made up one" buttons decrement manually, floored at 0. The UI explains
  qada as "make-up prayers owed".
- **Dashboard** -- today's x/5 hero; full-day streak (consecutive days
  ending today-or-yesterday with all 5 prayed); per-prayer 30-day
  consistency % bars (done / marked, shown as "none" when never marked);
  a 7-day weekly grid of x/5 dots; an SVG 30-day trend bar chart.
- **History** -- last 30 days, each row a date with 5 status dots. Tapping
  a past date opens an inline editor with the same 5 toggles; a jump-to-date
  field blocks future dates with an inline message. Deleting an entry
  clears the day (two-tap confirm).
- **Data** -- JSON export (download), JSON import with strict schema
  validation (malformed files are rejected and existing data stays intact),
  and erase-all guarded by typing DELETE.
- **Bilingual** -- EN/Bangla toggle, persisted in localStorage; Bengali
  digits in BN mode. All Bengali ships as `\uXXXX` escapes in the sources.
- **Offline-first** -- zero network requests by design; works from
  `file://`. Data lives in `localStorage` (key `namaz-tracker-bd-v1`);
  corrupted storage is detected and the app restarts fresh with a notice.

## Stack

- Plain HTML + CSS + JavaScript. No frameworks, no build step, no CDNs.
- `js/logic.js` -- pure, DOM-free logic (also `require()`-able in Node).
- `js/app.js` -- DOM rendering and events; `?asof=YYYY-MM-DD` overrides
  "today" for deterministic testing.
- Tests: Node unit tests + headless-Chrome smoke tests over raw CDP.

## Install / run

No install needed. Open `index.html` in any modern browser, or serve it:

```sh
# option 1: just open the file
xdg-open index.html

# option 2: local server
python3 -m http.server 8080
# then visit http://localhost:8080/
```

## Dev commands

```sh
# unit tests (needs only node)
node tests/run-node-tests.js

# browser smoke tests (needs /opt/meta-chromium/chrome on this VM;
# uses raw CDP, no npm packages)
node tests/smoke.mjs .

# ASCII hygiene check (all sources must be pure ASCII;
# Bengali ships as \uXXXX escapes)
grep -rP '[^\x00-\x7F]' index.html css/ js/ tests/ README.md TEST_RESULTS.md .gitignore \
  && echo "NON-ASCII FOUND" || echo "ASCII CLEAN"
```

The smoke test uses `index.html?asof=2026-10-13` so "today" is deterministic.

## Testing

- `tests/run-node-tests.js` -- 142 assertions: date helpers (strict ISO
  incl. leap days, UTC weekday, day arithmetic), Bengali digit formatting,
  setPrayer validation, the qada delta rules (missed +1, missed-to-done -1,
  missed-to-null -1, no double count, floor at 0), the hand-verified streak
  scenario (Oct 10/11/12 full + Oct 13 partial -> streak 3; completing Oct 13
  -> 4; gap breaks to 1), per-prayer streaks, 30-day consistency (3 done of
  4 marked -> 75%), weekly/trend/history shapes, clearDay, export/import
  round-trip, 18 malformed-import cases, i18n key/placeholder parity, and
  corrupt-storage recovery.
- `tests/smoke.mjs` -- 57 checks in headless Chrome: boot with `?asof=`,
  5 cards, Prayed/Missed toggles and unmark, qada increment/decrement/floor,
  Friday Jummah label (via `?asof=2026-10-16`), BN toggle with Bengali digits
  + reload persistence, dashboard widgets (hero, streak, 5 consistency rows,
  7 weekly cells, 30 trend bars), history editor + jump-to-date + future-date
  block + two-tap delete, export -> typed-DELETE erase -> import round-trip,
  malformed import rejected with data intact, 390px mobile (no horizontal
  overflow on any tab), and zero non-`file://` network requests.

See `TEST_RESULTS.md` for the full recorded results.

## Deployment (GitHub Pages)

This is a static site -- any static host works:

1. Push `index.html`, `css/`, `js/`, `README.md`, `.gitignore` to a repo.
2. Enable GitHub Pages (Settings -> Pages -> Deploy from branch -> `main`).
3. Open `https://<user>.github.io/<repo>/`.

No server, no environment variables, no secrets.

## Limitations

- Single-device: data lives in the browser's `localStorage`; no sync, no
  accounts, no sharing.
- No prayer-time reminders or timetables -- that is prayer-times-bd's lane.
  This app tracks what you did, not when to pray.
- Streaks count only days with all 5 marked done; days with unmarked
  prayers break the chain (documented rule, shown under the streak).
- Consistency % is done / marked over the last 30 days; prayers never
  marked show "none".
- Import replaces all current data (after successful validation only).
- A personal tracker for your prayers. Not a religious authority.

## License

MIT -- do what you want, no warranty.
