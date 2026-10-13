# TEST_RESULTS.md -- namaz-tracker-bd (factory run #51, 2026-10-13 11:00 slot)

## Summary

- Node unit: **142/142 passed**
- Headless-Chrome smoke: **57/57 passed** (two consecutive full runs, 0 console/page errors)
- ASCII hygiene: `grep -P '[^\x00-\x7F]'` -> **0 matches** across
  `index.html`, `css/`, `js/`, `tests/`, `README.md`, `TEST_RESULTS.md`, `.gitignore`
  (Bengali ships as `\uXXXX` escapes; verified by decode round-trip against
  the Bengali source text: 11/11 key strings matched, e.g. `name_fajr` ->
  the Bengali word for Fajr, `xOfY(3,5,"bn")` -> Bengali "3/5")
- Network: **0 non-`file://` requests** by design (no CDNs, no webfonts)

## Unit tests (`node tests/run-node-tests.js`) -- 142/142

| Area | Checks |
|---|---|
| Date helpers | todayISO format; strict ISO incl. leap-day 2024-02-29 ok / 2023-02-29 rejected / month 13 / day 32 / garbage / non-padded; future-date guard; addDaysISO incl. month/year boundaries; weekdayOf 2026-10-13=Tue / 2026-10-16=Fri; isFriday |
| Bengali digits | bnDigits 0-9; num/xOfY/pctStr EN vs BN |
| setPrayer | done/missed/null stored; same-status no-op; done->missed qada +1; repeat missed no double count; missed->done qada -1; missed->null qada -1; null->done no qada change; empty day removed; invalid date / future date / unknown prayer / bad status rejected |
| madeUpOne | decrements; floor at 0; unknown prayer fails |
| Day math | dayDoneCount; isFullDay (partial false, 5/5 true, missing day false); totalQada |
| **Hand-verified streak** | Oct 10/11/12 full + Oct 13 (today) partial -> **streak 3** (ends yesterday); completing Oct 13 -> **4**; gap (Oct 11 missing) -> **1**; empty -> **0**; today-only full -> **1**; today partial + yesterday not full -> **0** |
| Per-prayer streak | fajr 3 consecutive -> 3; asr missed yesterday -> 1; never marked -> 0 |
| **Hand-verified consistency** | fajr 3 done + 1 missed in window -> **{done:3, marked:4, pct:75}**; out-of-window mark excluded; never marked -> null; all missed -> 0% |
| Grid shapes | weeklyGrid 7 cells, 2026-10-07..2026-10-13, done counts; trend30 30 bars, starts 2026-09-14; historyKeys newest-first |
| clearDay | ok removes day; future date rejected |
| Export/import | round-trip exact incl. lang=bn; `app:"namaz-tracker-bd"`, version 1; **18 malformed cases rejected** (non-JSON, wrong app, wrong version, missing data, days-not-object, bad/non-ISO/future date keys, unknown prayer, bad status value/type, negative/float/missing qada, bad/missing lang, null/array root); failed import never touches caller state; valid import still ok after rejections |
| i18n | 60+ keys EN/BN parity; no empty values; `{n}`/`{k}` placeholder sets match per key; missing-key and unknown-lang fallback; `errImport` placeholder renders |
| Storage | empty -> blank; garbage JSON -> corrupt+blank; schema-invalid -> corrupt+blank; save->load round-trip exact |

## Smoke tests (`node tests/smoke.mjs .`, raw CDP, `/opt/meta-chromium/chrome`, `file://?asof=2026-10-13`) -- 57/57

- App boots; asof=2026-10-13; 5 prayer cards; progress starts 0/5
- Fajr Prayed -> 1/5; tap again -> unmarks to 0/5; mark again
- Dhuhr Missed -> qada dhuhr 1, total 1
- Maghrib Missed then Prayed -> qada back to 0 (delta rule in UI)
- Asr Missed -> qada 1; "Made up one" -> 0; second tap stays 0 (floor)
- `?asof=2026-10-16` (Friday): Dhuhr card shows "Jummah"; back on Tuesday: no Jummah label
- BN toggle: progress renders Bengali "2/5", qada title in Bengali; reload persists lang (toggle shows EN) and state
- Dashboard: hero 2/5; streak "0 days" (today partial, yesterday empty); 5 consistency rows; 7 weekly cells; 30 trend bars
- History: 1 row; click opens editor with date title; Isha Prayed -> 3 done dots; jump to 2026-10-12, mark Fajr -> 2 rows; future date 2026-10-14 blocked with inline error; two-tap delete clears entry -> 1 row
- Data: export captured (`"app": "namaz-tracker-bd"`); clear button disabled until DELETE typed; erase -> progress 0/5, qada 0; import round-trip -> progress 3/5, qada total 1
- Malformed import rejected with inline error; data intact (progress still 3/5)
- 390px viewport: `document.documentElement.scrollWidth <= 391` on all 4 tabs
- 0 non-file network requests; **0 console errors; 0 page errors**

## Repairs

- **Repair cycle 1 (CSS, found by smoke):** dashboard weekly grid overflowed
  at 390px (`scrollWidth` 408): 7 fixed `1fr` tracks could not shrink below
  the dot-row min-content. Fixed with `repeat(7, minmax(0, 1fr))`,
  `min-width: 0` + `overflow: hidden` on cells, 6px dots, and ellipsis on
  weekday labels. Re-ran: 57/57, all tabs <= 391px.
- **0 app-logic bugs found by tests.** Two consecutive full green runs after
  the CSS fix.
- Build-hygiene: all Bengali authored literally then converted to `\uXXXX`
  escapes by script; `grep` confirms 0 non-ASCII bytes in sources; decode
  round-trip verified 11/11 strings.

## Notes / discrepancies

- None. The hand-verified streak and consistency cases in the run brief
  (3 consecutive full days + today partial -> streak 3; fajr 3/4 marked ->
  75%) match the implementation exactly.
- Qada is independent of day entries: "Made up one" decrements the counter
  directly and never edits history (documented in README).
