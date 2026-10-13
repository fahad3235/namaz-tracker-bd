// Headless-Chrome smoke tests for namaz-tracker-bd (raw CDP, file:// + ?asof=). ASCII only.
import { launchChrome, waitPort, newPage, CDP, sleep } from "./cdp.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIR = path.resolve(process.argv[2] || ".");
const FILE_URL = pathToFileURL(path.join(DIR, "index.html")).href;
const PAGE_URL = FILE_URL + "?asof=2026-10-13";
const FRIDAY_URL = FILE_URL + "?asof=2026-10-16";
const PORT = 9444 + (process.pid % 500);

let pass = 0, fail = 0;
const failures = [];
function check(c, msg, extra) {
  if (c) { pass++; }
  else { fail++; failures.push(msg + (extra !== undefined ? " | got: " + JSON.stringify(extra) : "")); }
}

const proc = launchChrome(PORT);
const errors = { console: [], page: [] };
const netReqs = [];
let cdp, page;
try {
  await waitPort(PORT);
  page = await newPage(PORT, PAGE_URL);
  cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  cdp.on("Runtime.consoleAPICalled", p => {
    if (p.type === "error") errors.console.push(JSON.stringify(p.args).slice(0, 300));
  });
  cdp.on("Log.entryAdded", p => {
    if (p.entry.level === "error") errors.console.push(p.entry.text.slice(0, 300));
  });
  cdp.on("Runtime.exceptionThrown", p => {
    errors.page.push((p.exceptionDetails.text || "exception").slice(0, 300));
  });
  cdp.on("Network.requestWillBeSent", p => { netReqs.push(p.request.url); });
  await cdp.send("Runtime.enable"); await cdp.send("Page.enable");
  await cdp.send("Network.enable"); await cdp.send("Log.enable");

  const ev = (js) => cdp.eval(js);
  async function waitFor(js, tries = 40) {
    for (let i = 0; i < tries; i++) {
      try { if (await ev(js)) return true; } catch (e) {}
      await sleep(150);
    }
    return false;
  }
  const click = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return "missing"; b.click(); return "ok"; })()`);

  check(await waitFor("!!window.__nt"), "app booted (window.__nt)");
  check(await ev("window.__nt.today()") === "2026-10-13", "asof override = today");
  check(await ev("document.querySelectorAll('#prayerCards .pcard').length") === 5, "5 prayer cards render");
  check(await ev("document.getElementById('progressText').textContent") === "0/5", "progress starts 0/5");

  // 2. mark Fajr Prayed -> 1/5
  check(await click('#prayerCards .pcard[data-prayer="fajr"] button[data-act="done"]') === "ok", "click Fajr prayed");
  check(await ev("document.getElementById('progressText').textContent") === "1/5", "progress 1/5");
  // tap again -> unmarks
  await click('#prayerCards .pcard[data-prayer="fajr"] button[data-act="done"]');
  check(await ev("document.getElementById('progressText').textContent") === "0/5", "tap again unmarks");
  await click('#prayerCards .pcard[data-prayer="fajr"] button[data-act="done"]');

  // 3. mark Dhuhr Missed -> qada dhuhr 1, total 1
  await click('#prayerCards .pcard[data-prayer="dhuhr"] button[data-act="missed"]');
  check(await ev("document.querySelector('.qrow[data-prayer=\"dhuhr\"] .qcount').textContent") === "1", "qada dhuhr = 1");
  check((await ev("document.getElementById('qadaTotal').textContent")).includes("1"), "qada total 1");

  // 4. Missed -> Prayed decrements qada (Maghrib)
  await click('#prayerCards .pcard[data-prayer="maghrib"] button[data-act="missed"]');
  check(await ev("document.querySelector('.qrow[data-prayer=\"maghrib\"] .qcount').textContent") === "1", "qada maghrib = 1");
  await click('#prayerCards .pcard[data-prayer="maghrib"] button[data-act="done"]');
  check(await ev("document.querySelector('.qrow[data-prayer=\"maghrib\"] .qcount').textContent") === "0", "missed->prayed decrements qada");

  // 5. made-up-one button + floor at 0 (Asr)
  await click('#prayerCards .pcard[data-prayer="asr"] button[data-act="missed"]');
  check(await ev("document.querySelector('.qrow[data-prayer=\"asr\"] .qcount').textContent") === "1", "qada asr = 1");
  await click('.qrow[data-prayer="asr"] .qmake');
  check(await ev("document.querySelector('.qrow[data-prayer=\"asr\"] .qcount').textContent") === "0", "made-up decrements");
  await click('.qrow[data-prayer="asr"] .qmake');
  check(await ev("document.querySelector('.qrow[data-prayer=\"asr\"] .qcount').textContent") === "0", "qada floor at 0");

  // 6. Friday: Dhuhr card shows Jummah label
  await cdp.send("Page.navigate", { url: FRIDAY_URL }); await sleep(600);
  check(await waitFor("!!window.__nt"), "friday page booted");
  await sleep(200);
  const dhuhrName = await ev("document.querySelector('#prayerCards .pcard[data-prayer=\"dhuhr\"] .pname').textContent");
  check(dhuhrName.includes("Jummah"), "Dhuhr labeled Jummah on Friday", dhuhrName);
  await cdp.send("Page.navigate", { url: PAGE_URL }); await sleep(600);
  check(await waitFor("!!window.__nt"), "back to tuesday page");
  await sleep(200);
  const dhuhrName2 = await ev("document.querySelector('#prayerCards .pcard[data-prayer=\"dhuhr\"] .pname').textContent");
  check(!dhuhrName2.includes("Jummah"), "no Jummah label on Tuesday", dhuhrName2);

  // 7. BN toggle: Bengali digits + persists after reload
  // done now: fajr, maghrib (2) -> 2/5
  await ev("document.getElementById('langBtn').click()"); await sleep(300);
  check(await ev("document.getElementById('progressText').textContent") === "\u09E8/\u09EB", "BN progress Bengali digits", await ev("document.getElementById('progressText').textContent"));
  const qadaTitle = await ev("document.getElementById('qadaTitle').textContent");
  check(qadaTitle.includes("\u0995\u09BE\u099C\u09BE"), "BN qada title", qadaTitle);
  await cdp.send("Page.navigate", { url: PAGE_URL }); await sleep(600);
  check(await waitFor("!!window.__nt"), "reloaded after BN toggle");
  await sleep(300);
  check(await ev("document.getElementById('langBtn').textContent") === "EN", "BN lang persisted");
  check(await ev("document.getElementById('progressText').textContent") === "\u09E8/\u09EB", "BN state persists after reload");
  await ev("document.getElementById('langBtn').click()"); await sleep(300); // back to EN

  // 8. dashboard widgets
  await ev(`(() => { document.querySelector('[data-tab="dashboard"]').click(); return true; })()`);
  await sleep(300);
  check(await ev("document.getElementById('dashHero').textContent") === "2/5", "dash hero 2/5");
  check(await ev("document.getElementById('streakVal').textContent") === "0 days", "streak 0 days (today partial)", await ev("document.getElementById('streakVal').textContent"));
  check(await ev("document.querySelectorAll('#consistRows .crow').length") === 5, "5 consistency rows");
  check(await ev("document.querySelectorAll('#weekGrid .wcell').length") === 7, "7 weekly cells");
  check(await ev("document.querySelectorAll('#trendSvg rect').length") === 30, "30 trend bars");

  // 9. history: open editor for today, mark Isha
  await ev(`(() => { document.querySelector('[data-tab="history"]').click(); return true; })()`);
  await sleep(300);
  check(await ev("document.querySelectorAll('#histList .hrow').length") === 1, "1 history row");
  await click('#histList .hrow[data-date="2026-10-13"]');
  await sleep(200);
  check(await ev("!document.getElementById('editor').hidden"), "editor opens");
  check((await ev("document.getElementById('edTitle').textContent")).includes("2026-10-13"), "editor title has date");
  await click('#edToggles .pcard[data-prayer="isha"] button[data-act="done"]');
  await sleep(200);
  check(await ev("document.querySelectorAll('#histList .hrow')[0].querySelectorAll('.dot.d').length") === 3, "3 done dots after isha marked");
  await click('#edClose');

  // 9b. jump to a past date, mark, then delete entry
  await ev(`(() => {
    const i = document.getElementById('jumpDate'); i.value = '2026-10-12';
    document.getElementById('jumpBtn').click(); return true;
  })()`);
  await sleep(300);
  check(await ev("!document.getElementById('editor').hidden"), "jump opens editor");
  check((await ev("document.getElementById('edTitle').textContent")).includes("2026-10-12"), "editor for 2026-10-12");
  await click('#edToggles .pcard[data-prayer="fajr"] button[data-act="done"]');
  await sleep(200);
  await click('#edClose');
  await sleep(200);
  check(await ev("document.querySelectorAll('#histList .hrow').length") === 2, "2 history rows now");
  // future date blocked
  await ev(`(() => {
    const i = document.getElementById('jumpDate'); i.value = '2026-10-14';
    document.getElementById('jumpBtn').click(); return true;
  })()`);
  await sleep(200);
  check(await ev("!document.getElementById('jumpErr').hidden"), "future date blocked inline");
  // delete entry (two-step confirm)
  await click('#histList .hrow[data-date="2026-10-12"]');
  await sleep(200);
  await click('#edDelete'); // arm
  check(await ev("document.getElementById('edDelete').classList.contains('armed')"), "delete armed");
  await click('#edDelete'); // confirm
  await sleep(300);
  check(await ev("document.getElementById('editor').hidden"), "editor closed after delete");
  check(await ev("document.querySelectorAll('#histList .hrow').length") === 1, "entry deleted, 1 row left");

  // 10. data tab: export -> clear (typed) -> import round-trip
  await ev(`(() => { document.querySelector('[data-tab="data"]').click(); return true; })()`);
  await sleep(200);
  await ev("document.getElementById('expBtn').click()"); await sleep(400);
  const exported = await ev("window.__lastExport");
  check(typeof exported === "string" && exported.includes('"app": "namaz-tracker-bd"'), "export JSON captured");
  // typed confirm: button disabled until DELETE typed
  check(await ev("document.getElementById('clearBtn').disabled") === true, "clear btn disabled initially");
  await ev(`(() => {
    const i = document.getElementById('clearInput'); i.value = 'DELETE';
    i.dispatchEvent(new Event('input', {bubbles:true})); return true;
  })()`);
  await sleep(200);
  check(await ev("document.getElementById('clearBtn').disabled") === false, "clear btn enabled after DELETE");
  await ev("document.getElementById('clearBtn').click()"); await sleep(400);
  await ev(`(() => { document.querySelector('[data-tab="today"]').click(); return true; })()`);
  await sleep(200);
  check(await ev("document.getElementById('progressText').textContent") === "0/5", "data cleared: progress 0/5");
  check((await ev("document.getElementById('qadaTotal').textContent")).includes("0"), "data cleared: qada 0");
  await ev(`(() => { document.querySelector('[data-tab="data"]').click(); return true; })()`);
  await sleep(200);
  const impOk = await ev("window.__importText(window.__lastExport)");
  await sleep(300);
  check(impOk === true, "import round-trip ok");
  await ev(`(() => { document.querySelector('[data-tab="today"]').click(); return true; })()`);
  await sleep(200);
  check(await ev("document.getElementById('progressText').textContent") === "3/5", "progress restored 3/5");
  check((await ev("document.getElementById('qadaTotal').textContent")).includes("1"), "qada total restored 1");

  // 11. malformed import rejected, data intact
  await ev(`(() => { document.querySelector('[data-tab="data"]').click(); return true; })()`);
  await sleep(200);
  const badOk = await ev(`window.__importText('{"app":"nope","version":1}')`);
  check(badOk === false, "malformed import rejected");
  check(await ev("!document.getElementById('dataMsg').hidden && document.getElementById('dataMsg').classList.contains('err')"), "import error shown");
  await ev(`(() => { document.querySelector('[data-tab="today"]').click(); return true; })()`);
  await sleep(200);
  check(await ev("document.getElementById('progressText').textContent") === "3/5", "data intact after bad import");

  // 12. 390px mobile: no horizontal overflow on every tab
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  for (const tab of ["today", "dashboard", "history", "data"]) {
    await ev(`(() => { document.querySelector('[data-tab="${tab}"]').click(); return true; })()`);
    await sleep(250);
    const sw = await ev("document.documentElement.scrollWidth");
    check(sw <= 391, "390px no overflow: " + tab, sw);
  }

  // 13. zero non-file network requests
  const ext = netReqs.filter(u => !u.startsWith("file://") && !u.startsWith("blob:") && !u.startsWith("data:"));
  check(ext.length === 0, "zero non-file network requests", ext.slice(0, 3));
} finally {
  try { cdp && cdp.close(); } catch (e) {}
  try { await fetch("http://127.0.0.1:" + PORT + "/json/close/" + (page && page.id), { method: "PUT" }).catch(() => {}); } catch (e) {}
  proc.kill();
}

check(errors.console.length === 0, "zero console errors", errors.console.slice(0, 3));
check(errors.page.length === 0, "zero page errors", errors.page.slice(0, 3));

console.log("\n" + pass + " passed, " + fail + " failed");
if (failures.length) { console.log("FAILURES:"); failures.forEach(f => console.log(" - " + f)); process.exit(1); }
