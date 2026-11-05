/**
 * LOCAL FORK ONLY. Gives our test wallets gas (anvil_setBalance) and USDT by writing the real USDT
 * contract's balance storage slot on the fork. These balances exist only on this laptop's anvil;
 * they are NOT real payments and must never be presented as such.
 * Usage: npx tsx scripts/fork-fund.ts
 */
import { encodeAbiParameters, encodeFunctionData, erc20Abi, formatUnits, keccak256, numberToHex, pad, parseEther, parseUnits, type Address, type Hex } from "viem";
import { USDT_ADDRESS } from "../packages/shared/src/index";
import { addrOf, WALLET_VARS } from "./env";
import { assertLocalAnvil, pub } from "./chain";

await assertLocalAnvil();
const token = USDT_ADDRESS as Address;
const decimals = await pub.readContract({ address: token, abi: erc20Abi, functionName: "decimals" });

const slotKey = (holder: Address, slot: bigint) =>
  keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [holder, slot]));

async function setStorage(key: Hex, value: bigint) {
  await pub.request({ method: "anvil_setStorageAt" as never, params: [token, key, pad(numberToHex(value), { size: 32 })] as never });
}

/** Write a marker at `key`, check balanceOf(holder), ALWAYS restore the old value (some keys are proxy slots). */
async function probeKey(key: Hex, holder: Address, marker: bigint): Promise<boolean> {
  const old = (await pub.getStorageAt({ address: token, slot: key })) ?? "0x0";
  await setStorage(key, marker);
  try {
    const bal = await pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [holder] });
    return bal === marker;
  } catch {
    return false;
  } finally {
    await setStorage(key, BigInt(old === "0x" ? 0 : old));
  }
}

/**
 * Find the balance storage key for a holder, programmatically:
 * 1) try plain mappings keccak(holder, slot) for slots 0..49;
 * 2) else ask the node which storage keys balanceOf(holder) reads (eth_createAccessList) and test each.
 * Returns a function holder -> storage key.
 */
async function findBalanceKey(): Promise<{ how: string; keyFor: (h: Address) => Promise<Hex> }> {
  const probe = "0x00000000000000000000000000000000000b0b0b" as Address;
  const works = (key: Hex) => probeKey(key, probe, 123456789n);
  for (let s = 0n; s < 50n; s++) {
    if (await works(slotKey(probe, s))) return { how: `mapping slot ${s}`, keyFor: async (h) => slotKey(h, s) };
  }
  const keysRead = async (h: Address) => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [h] });
    const res = (await pub.request({
      method: "eth_createAccessList" as never,
      params: [{ to: token, data }, "latest"] as never,
    })) as { accessList: { address: string; storageKeys: Hex[] }[] };
    return res.accessList.find((e) => e.address.toLowerCase() === token.toLowerCase())?.storageKeys ?? [];
  };
  for (const key of await keysRead(probe)) {
    if (await works(key)) {
      // The key depends on the holder; resolve it per holder the same way.
      return {
        how: "access-list key",
        keyFor: async (h) => {
          for (const k of await keysRead(h)) {
            if (await probeKey(k, h, 987654321n)) return k;
          }
          throw new Error(`no balance key for ${h}`);
        },
      };
    }
  }
  throw new Error("USDT balance storage key not found");
}

const found = await findBalanceKey();
console.log(`USDT balance storage found via ${found.how} (decimals ${decimals})`);

const usdtFor: Record<string, string> = { "TEST_BUYER_PK": "100", "FAUCET_PK": "1000" };
const rows = [];
for (const [role, v] of [...WALLET_VARS, ["seller", "SELLER_PK"] as const]) {
  const a = addrOf(v);
  await pub.request({ method: "anvil_setBalance" as never, params: [a, numberToHex(parseEther("10"))] as never });
  if (usdtFor[v]) await setStorage(await found.keyFor(a), parseUnits(usdtFor[v], decimals));
  const usdt = await pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [a] });
  rows.push({ role, address: a, gas: "10 (fork)", USDT: formatUnits(usdt, decimals) });
}
console.table(rows);
console.log("LOCAL FORK balances only. Not real tokens.");
