import { NextResponse, connection } from "next/server";
import { dispatchWebhooks } from "@/lib/server/webhooks";

/**
 * Runs one webhook pass (scan new checkout events, enqueue, deliver, retry). Idempotent and read-only on chain: it only tells
 * merchants about facts already on-chain, so it needs no auth. Also called from `npm run webhooks` and (best effort) after order
 * registration; a cron can hit it too.
 */
export async function POST() {
  return run();
}

/** Same pass for GET: Vercel Cron only issues GET requests. */
export async function GET() {
  return run();
}

async function run() {
  await connection();
  try {
    return NextResponse.json(await dispatchWebhooks());
  } catch (e) {
    console.error("[webhooks] dispatch failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }
}
