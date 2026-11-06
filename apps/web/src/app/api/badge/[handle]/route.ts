import { connection } from "next/server";
import { zeroAddress, type Address } from "viem";
import { checkoutAbi, chunkedLogs, handleHash, registryAbi } from "@pop/shared";
import { deployment, pub } from "@/lib/server/chain";
import { POP_MARK_64 } from "@/lib/brand-mark";

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// An SVG shown through <img> cannot load web fonts, so it uses the system sans stack.
const FONT = `-apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;

// Hex values copied from the tokens in apps/web/src/app/globals.css (an SVG served on its own cannot read CSS variables):
// #ffffff bg, #f6f7f9 surface, #dadce3 line, #0b1020 ink, #3d4354 ink-2, #a31515 danger, #fdecec danger-soft.
type Palette = { bg: string; border: string; title: string; body: string };
type Tone = "ok" | "danger" | "grey";
const PALETTES: Record<"light" | "dark", Record<Tone, Palette>> = {
  light: {
    ok: { bg: "#ffffff", border: "#dadce3", title: "#0b1020", body: "#3d4354" },
    danger: { bg: "#fdecec", border: "#a31515", title: "#a31515", body: "#0b1020" },
    grey: { bg: "#f6f7f9", border: "#dadce3", title: "#0b1020", body: "#3d4354" },
  },
  dark: {
    ok: { bg: "#0b1020", border: "#3d4354", title: "#ffffff", body: "#dadce3" },
    danger: { bg: "#a31515", border: "#a31515", title: "#ffffff", body: "#ffffff" },
    grey: { bg: "#3d4354", border: "#3d4354", title: "#ffffff", body: "#f6f7f9" },
  },
};

const H = 60;
const PAD = 14;
const MARK = 32;
const TEXT_X = PAD + MARK + 12;
const MIN_W = 240;
const MAX_W = 420;
const T1 = 15; // title size, bold
const T2 = 13; // detail size
// Rough width of the system sans stack: about 0.58 x font size per character (a little more for bold).
const est = (s: string, size: number, bold = false) => Math.ceil(s.length * size * (bold ? 0.62 : 0.58));

/**
 * Lays out the badge. `details` lists the second line from longest to shortest; the first one that fits is used,
 * and the label and <title> always carry the full sentence. The width grows with the text, between 240 and 420 px.
 */
function svg(tone: Tone, theme: "light" | "dark", title: string, details: string[], sentence: string) {
  const p = PALETTES[theme][tone];
  const room = MAX_W - TEXT_X - PAD;
  const detail = details.find((d) => est(d, T2) <= room) ?? details[details.length - 1];
  const need = Math.max(est(title, T1, true), est(detail, T2));
  const w = Math.min(MAX_W, Math.max(MIN_W, TEXT_X + need + PAD));
  // Last resort for an unusually wide line: squeeze it into the room rather than clip it.
  const squeeze = est(detail, T2) > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : "";
  const top = (H - MARK) / 2;
  const mark =
    tone === "danger"
      ? // A plain cross in a square, so a refused handle never carries the PoP logo.
        `<rect x="${PAD + 1}" y="${top + 1}" width="${MARK - 2}" height="${MARK - 2}" rx="7" fill="none" stroke="${p.title}" stroke-width="2"/>
<path d="M${PAD + 10} ${top + 10} L${PAD + MARK - 10} ${top + MARK - 10} M${PAD + MARK - 10} ${top + 10} L${PAD + 10} ${top + MARK - 10}" stroke="${p.title}" stroke-width="2.5" stroke-linecap="round"/>`
      : `<image x="${PAD}" y="${top}" width="${MARK}" height="${MARK}" href="${POP_MARK_64}"/>`;
  const s = esc(sentence);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="img" aria-label="${s}">
<title>${s}</title>
<rect x="0.5" y="0.5" width="${w - 1}" height="${H - 1}" rx="10" fill="${p.bg}" stroke="${p.border}"/>
${mark}
<text x="${TEXT_X}" y="27" fill="${p.title}" font-family="${FONT}" font-size="${T1}" font-weight="700">${esc(title)}</text>
<text x="${TEXT_X}" y="45" fill="${p.body}" font-family="${FONT}" font-size="${T2}"${squeeze}>${esc(detail)}</text>
</svg>`;
}

const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff" } });

/**
 * Embeddable "Protected by PoP" badge for a seller: live counters straight from the contracts (completed / total protected orders).
 * ?theme=dark for dark pages; anything else is light. Unknown or banned handles get a red badge (404), a chain outage a grey one (503).
 * Text only comes from our own data (the handle is regex-checked and escaped; a handle that fails the check is never echoed).
 */
export async function GET(req: Request, ctx: { params: Promise<{ handle: string }> }) {
  await connection();
  const theme = new URL(req.url).searchParams.get("theme") === "dark" ? "dark" : "light";
  const handle = decodeURIComponent((await ctx.params).handle).trim().toLowerCase().replace(/\.svg$/, "").replace(/^@/, "");
  const refused = (who: string) => reply(svg("danger", theme, "Not a registered seller", [`${who} is not a PoP seller`], `Not a registered seller: ${who} is not a PoP seller.`), 404);
  if (!HANDLE_RE.test(handle)) return refused("This handle");
  const at = `@${handle}`;
  try {
    const d = deployment();
    const owner = (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [handleHash(handle)] })) as Address;
    const active = owner !== zeroAddress && (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [owner] }));
    if (!active) return refused(at);
    const completed = (await pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "completed", args: [owner] })).toString();
    const tip = await pub.getBlockNumber({ cacheTime: 0 });
    const funded = await chunkedLogs(BigInt(d.deployBlock), tip, (fromBlock, toBlock) =>
      pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller: owner }, fromBlock, toBlock }),
    );
    const record = `${completed} of ${funded.length}`;
    const fresh = funded.length === 0;
    const details = fresh
      ? [`${at} · ${record} orders completed, new seller`, `${at} · new seller, ${record} completed`, `${at} · ${record} completed`]
      : [`${at} · ${record} orders completed`, `${at} · ${record} completed`];
    const sentence = `Protected by PoP: ${at} has ${record} protected orders completed${fresh ? ", a new seller" : ""}.`;
    return reply(svg("ok", theme, "Protected by PoP", details, sentence));
  } catch {
    return reply(svg("grey", theme, "PoP", ["Record unavailable, try again"], "PoP: this seller's record is unavailable right now, try again."), 503);
  }
}
