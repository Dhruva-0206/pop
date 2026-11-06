/**
 * Pay with PoP, browser half. No keys here: it only asks YOUR server to create a checkout session
 * (your server uses `@pop/checkout-sdk/server`) and sends the buyer to the PoP checkout page it returns.
 */
export async function startPayWithPoP(endpoint: string, body?: unknown): Promise<void> {
  const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!r.ok || !j.url) throw new Error(j.error ?? `checkout failed (${r.status})`);
  window.location.assign(j.url);
}

/** Drop-in button for plain pages: mountPayWithPoP(document.getElementById("pay")!, "/api/checkout"). */
export function mountPayWithPoP(el: HTMLElement, endpoint: string, body?: unknown): void {
  const b = document.createElement("button");
  b.textContent = "Pay with PoP · protected checkout";
  b.onclick = () => {
    b.disabled = true;
    startPayWithPoP(endpoint, body).catch((e: Error) => ((b.disabled = false), (b.textContent = e.message)));
  };
  el.replaceChildren(b);
}
