import { Suspense } from "react";
import { connection } from "next/server";
import { formatUnits } from "viem";
import { arkivProof, contractFacts, recentOrders, worldLog, RABDI_CHAIN_ID } from "@/lib/server/proof";
import { ARKIV_SMOKE, EXPLORER, STATIC_TXS, TEST_COUNTS } from "@/lib/proof-data";
import ExpiredList from "./ExpiredList";

export const metadata = { title: "Proof" };

/** The Arkiv smoke-test entity (gate 3) is a real entity but not a review of a real order. */
const isSmoke = (r: { key: string }) => r.key.toLowerCase() === ARKIV_SMOKE.entityKey.toLowerCase();
/** Table order: regular reviews first, then DEV entries, then the smoke entity. Stable within each group. */
const kindRank = (r: { key: string; dev: boolean }) => (isSmoke(r) ? 2 : r.dev ? 1 : 0);

const ARKIV_QUERY = `import { createPublicClient, http } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { defineSchema, addr, str, u256, u64, bytes } from "@arkiv-network/sdk/schema";

const Review = defineSchema("pop_review_v1", {
  seller: addr().indexed(), order_id: u256().indexed(), rating: u64().indexed(),
  created_at: u64().indexed(), reviewer_key: str().indexed(), buyer_history: u64().indexed(),
  pay_tx: str(), text: bytes(), buyer_sig: bytes(),
});
const client = createPublicClient({ chain: rabdi({ accessKey: "<YOUR_ARKIV_ACCESS_KEY>" }), transport: http() });
const page = await client
  .select({ $key: true, $owner: true, $creator: true, $creationFlags: true, seller: true, order_id: true, rating: true })
  .from(Review)
  .createdBy("<ATTESTOR_ADDRESS shown above>")
  .limit(25)
  .fetch();
// keep only rows where $creator === attestor AND $creationFlags.readonly === true`;

export default function Page() {
  return (
    <div className="page-wide stack">
      <h1 className="text-2xl font-semibold">Proof</h1>
      <p className="text-muted">
        Everything on this page can be checked by someone else: contract addresses, transaction hashes, Arkiv entity keys with a query you can run, the World
        verification log (no secrets) and test counts. Test USDT only; nothing here has any value.
      </p>
      <Suspense fallback={<p className="text-muted">Reading the chain…</p>}>
        <Live />
      </Suspense>
      <Static />
    </div>
  );
}

const tx = (h: string) => (
  <a className="mono break-all text-xs text-accent-strong underline" href={`${EXPLORER}/tx/${h}`} target="_blank" rel="noreferrer">
    {h.slice(0, 10)}…{h.slice(-6)}
  </a>
);

async function Live() {
  await connection();
  const [facts, orders, arkiv, world] = await Promise.all([contractFacts(), recentOrders(25).catch(() => null), arkivProof(), worldLog().catch(() => null)]);
  const link = (kind: "address" | "tx", v: string, label?: string) =>
    facts.explorer ? (
      <a className="mono break-all text-xs text-accent-strong underline" href={`${facts.explorer}/${kind}/${v}`} target="_blank" rel="noreferrer">
        {label ?? `${v.slice(0, 10)}…${v.slice(-6)}`}
      </a>
    ) : (
      <span className="mono break-all text-xs">{label ?? `${v.slice(0, 10)}…${v.slice(-6)}`}</span>
    );
  const expired = (orders ?? []).filter((o) => o.canFinalize);
  const row = (k: string, v: React.ReactNode) => (
    <div className="border-b py-2 sm:flex sm:gap-4">
      <dt className="text-sm text-muted sm:w-44 sm:shrink-0">{k}</dt>
      <dd className="break-words">{v}</dd>
    </div>
  );
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contracts (live)</h2>
        {facts.isLocalFork && <div className="rounded-control bg-warn-soft p-2 text-xs font-semibold text-warn">LOCAL FORK: these addresses exist only on this laptop. The testnet evidence is further down.</div>}
        <dl>
            {row("Network", `${facts.isLocalFork ? "Local fork" : "Whitechain Sepolia"} (chain ${facts.chainId})`)}
            {row("PoPCheckout", link("address", facts.checkout, facts.checkout))}
            {row("SellerRegistry", link("address", facts.registry, facts.registry))}
            {row("Test USDT", <>{link("address", facts.token, facts.token)} ({facts.tokenDecimals} decimals)</>)}
            {row(`Treasury (fee ${facts.feeBps / 100}%)`, link("address", facts.treasury, facts.treasury))}
            {row("Windows", `${facts.shortWindow} s trusted sellers · ${facts.longWindow} s others · arbiter decides within ${facts.arbiterTimeout} s · trusted after ${facts.trustedMin} completed orders`)}
            {row("Held right now", `${Number(formatUnits(BigInt(facts.totalLocked), facts.tokenDecimals)).toFixed(2)} locked in open orders · ${Number(formatUnits(BigInt(facts.totalCredit), facts.tokenDecimals)).toFixed(2)} waiting to be withdrawn`)}
            {facts.faucet &&
              row(
                "Test faucet, left",
                <>
                  {link("address", facts.faucet.address, facts.faucet.address)} · {Number(formatUnits(BigInt(facts.faucet.usdt), facts.tokenDecimals)).toFixed(2)} test USDT · {Number(formatUnits(BigInt(facts.faucet.gas), 18)).toFixed(3)} test WBT. Each new test wallet takes 2 test USDT.
                </>,
              )}
            {row("Deployed at block", facts.deployBlock)}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Orders (live, newest first)</h2>
        {!orders ? (
          <p className="text-muted">Could not read orders right now.</p>
        ) : orders.length === 0 ? (
          <p className="text-muted">No orders yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>State</th>
                  <th className="text-right">USDT</th>
                  <th>Paid</th>
                  <th>Shipped</th>
                  <th>Delivered</th>
                  <th>Settled</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.orderId}>
                    <td>{o.orderId}</td>
                    <td>{o.state}</td>
                    <td className="mono text-right">{Number(formatUnits(BigInt(o.amount), facts.tokenDecimals)).toFixed(2)}</td>
                    <td>{o.txs.funded ? link("tx", o.txs.funded) : ""}</td>
                    <td>{o.txs.shipped ? link("tx", o.txs.shipped) : ""}</td>
                    <td>{o.txs.delivered ? link("tx", o.txs.delivered) : ""}</td>
                    <td>
                      {o.txs.settled ? (
                        <>
                          {link("tx", o.txs.settled)} <span className="text-muted">{o.txs.settleEvent?.replace("Order", "")}</span>
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Finalize expired orders</h2>
        <p className="text-muted">A missed ship-by or deliver-by deadline lets anyone settle the order into a full refund; a finished dispute window lets anyone pay the seller. Nobody needs our permission.</p>
        <ExpiredList orders={expired.map((o) => ({ orderId: o.orderId, state: o.state, amount: o.amount }))} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Reviews on Arkiv (live)</h2>
        {!arkiv.ok ? (
          <p className="text-muted">{arkiv.reason}</p>
        ) : (
          <>
            <p className="text-muted">
              Reviews are read-only entities created by our attestor <span className="mono break-all text-xs">{arkiv.attestor}</span> on Arkiv Rabdi (chain {RABDI_CHAIN_ID}) and handed to the
              buyer. Readers trust only entities whose creator is the attestor and that are read-only.
            </p>
            {arkiv.rows.length === 0 ? (
              <p className="text-muted">No review entities yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Entity key</th>
                      <th>Owner</th>
                      <th>Read-only</th>
                      <th>Order</th>
                      <th>Stars</th>
                      <th>Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...arkiv.rows]
                      .sort((a, b) => kindRank(a) - kindRank(b))
                      .map((r) => (
                      <tr key={r.key}>
                        <td>
                          {r.key.slice(0, 12)}…{r.key.slice(-6)}
                        </td>
                        <td>{r.owner.slice(0, 8)}…</td>
                        <td>{r.readonly ? "yes" : "NO"}</td>
                        <td>{r.orderId}</td>
                        <td>{r.rating}</td>
                        <td>{isSmoke(r) ? "smoke test (not a real order)" : r.dev ? "DEV entry (no World proof; expires in 24 h)" : "regular entry (counts only if tied to a real payment)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">World ID verification log</h2>
        <p className="text-muted">
          Every attempt, without secrets: no proof, no signal and no raw nullifier is stored (only the first 12 hex characters of its sha256, enough to see that two rows are the same person).
        </p>
        {!world ? (
          <p className="text-muted">Log unavailable.</p>
        ) : world.length === 0 ? (
          <p className="rounded-control bg-warn-soft p-2 text-warn">No World verification has run on this deployment yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When (UTC)</th>
                  <th>Seller</th>
                  <th>Order</th>
                  <th>Result</th>
                  <th>Env</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {world.map((w, i) => (
                  <tr key={i}>
                    <td>{w.at.slice(0, 19).replace("T", " ")}</td>
                    <td>{w.sellerHandle ? `@${w.sellerHandle}` : ""}</td>
                    <td>{w.orderId}</td>
                    <td>{w.outcome}</td>
                    <td>{w.environment}</td>
                    <td>
                      {w.detail}
                      {w.nullifierHint ? ` · id ${w.nullifierHint}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Static() {
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Transactions on Whitechain Sepolia (recorded)</h2>
        {STATIC_TXS.map((g) => (
          <div key={g.group}>
            <div className="font-semibold">{g.group}</div>
            <ul className="ml-4 list-disc">
              {g.txs.map((t) => (
                <li key={t.hash}>
                  {t.label}: {tx(t.hash)}
                  {t.note ? <span className="text-muted"> · {t.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Arkiv entity, step by step (recorded)</h2>
        <p>
          Smoke-test entity, not a real order (Rabdi chain {ARKIV_SMOKE.chainId}): key <span className="break-all font-mono text-xs">{ARKIV_SMOKE.entityKey}</span>
        </p>
        <ul className="ml-4 list-disc">
          <li>
            created by the attestor, read-only: tx <span className="break-all font-mono text-xs">{ARKIV_SMOKE.createTx.hash}</span> (block {ARKIV_SMOKE.createTx.block})
          </li>
          <li>
            ownership handed to the buyer: tx <span className="break-all font-mono text-xs">{ARKIV_SMOKE.transferTx.hash}</span> (block {ARKIV_SMOKE.transferTx.block})
          </li>
        </ul>
        <div className="font-semibold">Run the query yourself</div>
        <pre className="overflow-x-auto rounded-control bg-surface p-3 text-xs text-ink">{ARKIV_QUERY}</pre>
        <p className="text-xs text-muted">Get a free access key at hub.arkiv.network. The schema also lives in arkiv/schema.md in the repository.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tests</h2>
        <ul className="ml-4 list-disc">
          <li>
            Contracts: {TEST_COUNTS.forge} (as of {TEST_COUNTS.asOf})
          </li>
          <li>
            End-to-end: {TEST_COUNTS.e2eFork}; {TEST_COUNTS.e2eMerchant}
          </li>
          <li className="font-mono text-xs">{TEST_COUNTS.forgeCmd}</li>
          <li className="font-mono text-xs">{TEST_COUNTS.e2eCmd}</li>
        </ul>
      </section>
    </>
  );
}
