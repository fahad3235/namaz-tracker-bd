// Minimal raw-CDP client (no dependencies). ASCII only.
import { spawn } from "node:child_process";

const CHROME = "/opt/meta-chromium/chrome";

export async function waitPort(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (r.ok) return true;
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("chrome debug port not up: " + port);
}

export function launchChrome(port) {
  const p = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--no-proxy-server", "--disable-gpu",
    "--remote-debugging-port=" + port, "--window-size=1280,900", "about:blank"
  ], { stdio: "ignore" });
  return p;
}

export class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.handlers = {}; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result);
      } else if (m.method && this.handlers[m.method]) {
        this.handlers[m.method].forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) { (this.handlers[method] = this.handlers[method] || []).push(fn); }
  async eval(js, awaitPromise = false) {
    const r = await this.send("Runtime.evaluate", {
      expression: js, returnByValue: true, awaitPromise
    });
    if (r.exceptionDetails) throw new Error("page exception: " + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

export async function newPage(port, url) {
  const r = await fetch("http://127.0.0.1:" + port + "/json/new?" + encodeURIComponent(url), { method: "PUT" });
  const j = await r.json();
  return j;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
