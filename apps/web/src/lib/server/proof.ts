import "server-only";
import { checkoutAbi, chunkedLogs, ORDER_STATES } from "@pop/shared";
import { listAttestorEntities, RABDI_CHAIN_ID, type ArkivEntityLine } from "@pop/shared/server/arkiv";
import { erc20Abi } from "viem";
import { deployment, mode, net, pub, serverWallet, store } from "./chain";
import { readOrder } from "./orders";
import { arkivAccessKey, attestorAddress } from "./reviews";

const ORDER_EVENTS = ["OrderFunded", "OrderShipped", "OrderDelivered", "OrderReleased", "OrderRefunded", "DisputeResolved"] as const;

export type ProofOrder = {
  orderId: string; state: string; seller: string; buyer: string; amount: string;
  txs: { funded?: string; shipped?: string; delivered?: string; settled?: string; settleEvent?: string };
  canFinalize: boolean;
};

/** The contracts' own settings, read live. */
export async function contractFacts() {
  const d = deployment();
  const read = <T,>(functionName: string) => pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: functionName as never }) as Promise<T>;
  const [treasury, feeBps, shortWindow, longWindow, trustedMin, arbiterTimeout, totalLocked, totalCredit] = await Promise.all([
    read<string>("treasury"), read<number>("feeBps"), read<number>("shortWindow"), read<number>("longWindow"),
    read<number>("trustedMinCompleted"), read<number>("arbiterTimeout"), read<bigint>("totalLocked"), read<bigint>("totalCredit"),
  ]);
  // What the test faucet has left (public address and balances only), so a person can see why a new test wallet might not get funds.
  const faucet = await (async () => {
    try {
      const address = serverWallet("FAUCET_PK").account.address;
      const [usdt, gas] = await Promise.all([
        pub.readContract({ address: d.token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
        pub.getBalance({ address }),
      ]);
      return { address, usdt: usdt.toString(), gas: gas.toString() };
    } catch {
      return null;
    }
  })();
  return {
    faucet,
    mode, chainId: net.chain.id, isLocalFork: net.isLocalFork, explorer: net.isLocalFork ? null : "https://explorer.testnet.whitechain.io",
    checkout: d.checkout, registry: d.registry, token: d.token, tokenDecimals: d.tokenDecimals, deployBlock: d.deployBlock,
    treasury, feeBps: Number(feeBps), shortWindow: Number(shortWindow), longWindow: Number(longWindow), trustedMin: Number(trustedMin),
    arbiterTimeout: Number(arbiterTimeout), totalLocked: totalLocked.toString(), totalCredit: totalCredit.toString(),
  };
}

/** Newest orders on this checkout with the tx hash of each step, straight from the contract's events (no database). */
export async function recentOrders(limit = 25): Promise<ProofOrder[]> {
  const d = deployment();
  const tip = await pub.getBlockNumber({ cacheTime: 0 });
  const from = BigInt(d.deployBlock);
  const lists = await Promise.all(
    ORDER_EVENTS.map(async (eventName) => ({
      eventName,
      evs: await chunkedLogs(from, tip, (fromBlock, toBlock) => pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName, fromBlock, toBlock })),
    })),
  );
  const tx = new Map<string, ProofOrder["txs"]>();
  const info = new Map<string, { seller: string; buyer: string }>();
  const slot = (id: string) => tx.get(id) ?? tx.set(id, {}).get(id)!;
  for (const { eventName, evs } of lists) {
    for (const e of evs) {
      const id = (e.args as { orderId: bigint }).orderId.toString();
      const t = slot(id);
      if (eventName === "OrderFunded") {
        t.funded = e.transactionHash;
        const a = e.args as { seller: string; buyer: string };
        info.set(id, { seller: a.seller, buyer: a.buyer });
      } else if (eventName === "OrderShipped") t.shipped = e.transactionHash;
      else if (eventName === "OrderDelivered") t.delivered = e.transactionHash;
      else {
        t.settled = e.transactionHash;
        t.settleEvent = eventName;
      }
    }
  }
  const ids = [...info.keys()].sort((a, b) => Number(b) - Number(a)).slice(0, limit);
  const out: ProofOrder[] = [];
  for (const id of ids) {
    const live = await readOrder(BigInt(id));
    if (!live) continue;
    out.push({ orderId: id, state: live.state, seller: live.seller, buyer: live.buyer, amount: live.amount, txs: tx.get(id)!, canFinalize: live.canFinalize });
  }
  return out;
}

export type ArkivProof = { ok: true; attestor: string; rows: ArkivEntityLine[] } | { ok: false; reason: string };
/** Reviews on Arkiv created by our attestor. The access key stays on the server; the page shows entity keys and a runnable query. */
export async function arkivProof(): Promise<ArkivProof> {
  try {
    const attestor = attestorAddress();
    return { ok: true, attestor, rows: await listAttestorEntities(arkivAccessKey(), attestor, 25) };
  } catch {
    return { ok: false, reason: "Arkiv is not reachable from this server right now (or no access key is configured)." };
  }
}

export const worldLog = () => store.worldVerifications(50);
export { RABDI_CHAIN_ID, ORDER_STATES };
