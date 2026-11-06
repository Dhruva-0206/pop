/**
 * Keeps merchant webhooks flowing: every few seconds asks the PoP web app to run one dispatch pass (scan new checkout events,
 * enqueue, deliver, retry). Orders pages also trigger passes, so this is only needed when nobody is looking at an order page.
 * On Vercel use a cron hitting POST /api/webhooks/dispatch instead.
 * Usage: npm run webhooks   (POP_URL defaults to http://localhost:3000)
 */
import { opt } from "./env";

const url = `${opt("POP_URL") ?? "http://localhost:3000"}/api/webhooks/dispatch`;
console.log(`webhook dispatcher loop -> ${url} (Ctrl+C to stop)`);
for (;;) {
  try {
    const r = await fetch(url, { method: "POST" });
    const j = (await r.json()) as { enqueued?: number; delivered?: number; failed?: number; error?: string };
    if (j.enqueued || j.delivered || j.failed || j.error) console.log(new Date().toISOString(), JSON.stringify(j));
  } catch (e) {
    console.log(new Date().toISOString(), "dispatch call failed:", e instanceof Error ? e.message : e);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
