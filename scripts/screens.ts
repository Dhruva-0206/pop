/**
 * Screenshot helper for UI review. Drives a local headless Chrome over the DevTools protocol (no extra npm package):
 * sets an exact viewport width, opens each page, waits until skeletons are gone, saves a full-page PNG and reports
 * horizontal overflow (scrollWidth > viewport width). Fork and local servers only.
 *
 *   npx tsx scripts/screens.ts <jobs.json> <outDir>
 *
 * jobs.json: [{ "name": "375-order", "url": "http://localhost:3200/o/1", "width": 375, "profile": "buyer",
 *               "storage": { "pop:testwallet:fork:31337:buyer": "$TEST_BUYER_PK" }, "steps": [...], "fold": true }]
 * `$NAME` values in `storage` are read from pop/.env and never printed. A "profile" keeps its localStorage between jobs.
 * Steps: { "type": [selector, text] } | { "click": selector } | { "waitUrl": "substring" } | { "wait": ms }.
 * "fold": also save the first screen only (name-fold.png), to check sticky bars.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { opt } from "./env";

type Step = { type?: [string, string]; click?: string; waitUrl?: string; wait?: number };
type Job = { name: string; url: string; width: number; profile?: string; storage?: Record<string, string>; steps?: Step[]; fold?: boolean; height?: number };

const [jobsFile, outDir] = process.argv.slice(2);
if (!jobsFile || !outDir) throw new Error("usage: npx tsx scripts/screens.ts <jobs.json> <outDir>");
const jobs: Job[] = JSON.parse(readFileSync(jobsFile, "utf8"));
mkdirSync(outDir, { recursive: true });
const CHROME = opt("CHROME_PATH") ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  private id = 0;
  private waiting = new Map<number, (v: { result?: unknown; error?: { message: string } }) => void>();
  private listeners: ((m: { method: string; params: unknown }) => void)[] = [];
  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id && this.waiting.has(m.id)) {
        this.waiting.get(m.id)!(m);
        this.waiting.delete(m.id);
      } else if (m.method) this.listeners.forEach((l) => l(m));
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(method: string, params: object = {}): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) =>
      this.waiting.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))),
    );
  }
  once(method: string, timeout = 30000) {
    return new Promise<void>((res) => {
      const t = setTimeout(res, timeout);
      const l = (m: { method: string }) => {
        if (m.method === method) {
          clearTimeout(t);
          this.listeners = this.listeners.filter((x) => x !== l);
          res();
        }
      };
      this.listeners.push(l);
    });
  }
}

async function open(profile: string, port: number): Promise<{ proc: ChildProcess; cdp: Cdp }> {
  const dir = join(tmpdir(), `pop-screens-${profile}`);
  const proc = spawn(CHROME, [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });
  let list: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 50 && !list.find((t) => t.type === "page"); i++) {
    await sleep(200);
    list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => []);
  }
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("Chrome did not start");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return { proc, cdp };
}

const evaluate = async (cdp: Cdp, expression: string) => (await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;

const browsers = new Map<string, { proc: ChildProcess; cdp: Cdp }>();
let port = 9330;
const report: string[] = [];
for (const job of jobs) {
  const prof = job.profile ?? "default";
  if (!browsers.has(prof)) browsers.set(prof, await open(prof, port++));
  const { cdp } = browsers.get(prof)!;
  const h = job.height ?? (job.width < 600 ? 800 : 900);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: job.width, height: h, deviceScaleFactor: 1, mobile: job.width < 600 });
  if (job.storage) {
    const origin = new URL(job.url).origin;
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: origin + "/api/config" });
    await loaded;
    for (const [k, raw] of Object.entries(job.storage)) {
      const v = raw.startsWith("$") ? (opt(raw.slice(1)) ?? "") : raw;
      await evaluate(cdp, `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
    }
    if (process.env.SCREENS_DEBUG) console.log("storage set on", await evaluate(cdp, "location.href"), "keys", await evaluate(cdp, "Object.keys(localStorage).length"));
  }
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: job.url });
  await loaded;
  for (const s of job.steps ?? []) {
    if (s.type) {
      await evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(s.type[0])}); el.focus(); })()`);
      await cdp.send("Input.insertText", { text: s.type[1] });
    } else if (s.click) {
      await evaluate(cdp, `document.querySelector(${JSON.stringify(s.click)}).click()`);
    } else if (s.waitUrl) {
      for (let i = 0; i < 240 && !String(await evaluate(cdp, "location.href")).includes(s.waitUrl); i++) await sleep(500);
    } else if (s.wait) await sleep(s.wait);
  }
  // Wait until the page has replaced its skeletons with content (max 15 s), then a short settle for fonts.
  for (let i = 0; i < 60 && (await evaluate(cdp, `!!document.querySelector('.skeleton,[aria-busy="true"]')`)); i++) await sleep(250);
  await sleep(1500);
  const m = await evaluate(cdp, `({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, h1: document.querySelectorAll('h1').length })`);
  if (job.fold) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(outDir, `${job.name}-fold.png`), Buffer.from(shot.data, "base64"));
  }
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: job.width, height: Math.min(m.sh, 12000), scale: 1 } });
  writeFileSync(join(outDir, `${job.name}.png`), Buffer.from(shot.data, "base64"));
  const line = `${job.name.padEnd(28)} ${m.sw > m.iw ? `OVERFLOW ${m.sw}px in ${m.iw}px` : "fits"} · h1 x${m.h1} · ${m.sh}px tall`;
  report.push(line);
  console.log(line);
}
for (const { proc } of browsers.values()) proc.kill();
writeFileSync(join(outDir, "report.txt"), report.join("\n") + "\n");
console.log(`saved ${jobs.length} screenshots to ${resolve(outDir)}`);
