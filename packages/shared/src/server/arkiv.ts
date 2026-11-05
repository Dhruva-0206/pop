/**
 * Arkiv (Rabdi testnet 7794095) access for PoP reviews. SERVER / SCRIPTS ONLY: it uses the Arkiv access key and
 * the attestor key. Never import this from client code.
 *
 * Reviews are `pop_review_v1` entities: created by the attestor, readonly, then transferred to the buyer.
 * Readers trust only rows whose `$creator` is the attestor AND that are readonly.
 */
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { addr, bytes, defineSchema, str, u256, u64 } from "@arkiv-network/sdk/schema";
import { and, eq } from "@arkiv-network/sdk/query";
import { hexToString, http, type Address, type Hex } from "viem";
import { getGasPrice } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";
import { ARKIV_SCHEMAS } from "../config";

export const RABDI_CHAIN_ID = 7794095;
/** reviewer_key prefix for reviews written with the DEV "skip World" flag. Never a real human proof. */
export const DEV_REVIEWER_PREFIX = "dev-";

/** Architecture §6.2. Keep in sync with arkiv/schema.md and scripts/smoke-arkiv.ts. */
export const ReviewSchema = defineSchema(ARKIV_SCHEMAS.review, {
  seller: addr().indexed(),
  order_id: u256().indexed(),
  rating: u64().indexed(),
  created_at: u64().indexed(),
  reviewer_key: str().indexed(), // hex keccak(nullifier, seller), never the raw nullifier
  buyer_history: u64().indexed(), // 0 = not computed yet
  pay_tx: str(),
  text: bytes(),
  buyer_sig: bytes(),
});

const transport = () => http(undefined, { retryCount: 0, timeout: 20_000 });

export function arkivReader(accessKey: string) {
  return createPublicClient({ chain: rabdi({ accessKey }), transport: transport(), cacheTime: 0 });
}

// One attestor key = one writer. Serialise writes in this process so nonces never race.
let writeChain: Promise<unknown> = Promise.resolve();
const serialised = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => undefined);
  return run;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PublishInput = {
  accessKey: string;
  attestorPk: Hex;
  seller: Address;
  buyer: Address;
  orderId: bigint;
  rating: number;
  text: string;
  reviewerKey: string;
  payTx: string;
  buyerSig: Hex;
  createdAt: number; // unix seconds
  /** 24 h for DEV reviews (they should fade), ~180 days otherwise (schema max is 7,884,000 blocks). */
  devEntity?: boolean;
};
export type PublishResult = { entityKey: Hex; createTx?: string; transferTx?: string; created: boolean; transferred: boolean };

/**
 * Idempotent publish of one review: look for an entity by (creator = attestor, order_id, seller) first, create it only
 * if absent, transfer ownership to the buyer only if the attestor still owns it, then read back and verify.
 * Safe to call again after any partial failure: it never creates a second entity for the same order.
 * Writes are never blind-retried inside this function.
 */
export function publishReview(i: PublishInput): Promise<PublishResult> {
  return serialised(async () => {
    const attestor = privateKeyToAccount(i.attestorPk);
    const chain = rabdi({ accessKey: i.accessKey });
    const reader = createPublicClient({ chain, transport: transport(), cacheTime: 0 });
    const wallet = createWalletClient({ chain, transport: transport(), account: attestor, cacheTime: 0 });

    const chainId = await reader.getChainId();
    if (chainId !== RABDI_CHAIN_ID) throw new Error(`Arkiv: expected chain ${RABDI_CHAIN_ID}, got ${chainId}`);

    const findMine = () =>
      reader
        .select({ $key: true, $owner: true, $creator: true, $creationFlags: true })
        .from(ReviewSchema)
        .createdBy(attestor.address)
        .where(and(eq("order_id", u256(i.orderId)), eq("seller", addr(i.seller))))
        .limit(5)
        .fetch();

    const existing = (await findMine()).entities[0];
    let entityKey = existing?.$key as Hex | undefined;
    let createTx: string | undefined;
    let created = false;

    if (!entityKey) {
      const gasPrice = await getGasPrice(reader);
      const res = await wallet.createEntity(
        ReviewSchema,
        {
          seller: addr(i.seller),
          order_id: u256(i.orderId),
          rating: u64(BigInt(i.rating)),
          created_at: u64(BigInt(i.createdAt)),
          reviewer_key: i.reviewerKey,
          buyer_history: u64(0n),
          pay_tx: i.payTx,
          text: new TextEncoder().encode(i.text),
          buyer_sig: Buffer.from(i.buyerSig.slice(2), "hex"),
        },
        {
          expiration: i.devEntity ? ExpirationTime.fromHours(24) : ExpirationTime.fromDays(180),
          flags: { readonly: true, permissionlessExtension: false },
        },
        { gas: 1_500_000n, gasPrice },
      );
      entityKey = res.entityKey as Hex;
      createTx = res.txHash;
      created = true;
    }

    // Reads may lag the write by a moment: poll, never re-write.
    const readBack = async () => {
      for (let n = 0; n < 15; n++) {
        const e = await reader.getEntity(entityKey!, ReviewSchema).catch(() => null);
        if (e) return e;
        await sleep(1000);
      }
      throw new Error("Arkiv: entity not readable after create");
    };
    let entity = await readBack();

    let transferTx: string | undefined;
    let transferred = false;
    if (entity.$owner?.toLowerCase() !== i.buyer.toLowerCase()) {
      if (entity.$owner?.toLowerCase() !== attestor.address.toLowerCase()) {
        throw new Error(`Arkiv: entity ${entityKey} is owned by neither attestor nor buyer`);
      }
      const gasPrice = await getGasPrice(reader);
      const t = (await wallet.changeOwnership({ entityKey: entityKey!, newOwner: i.buyer }, { gas: 1_000_000n, gasPrice })) as {
        txHash?: string;
      };
      transferTx = t.txHash;
      transferred = true;
      for (let n = 0; n < 15; n++) {
        entity = await readBack();
        if (entity.$owner?.toLowerCase() === i.buyer.toLowerCase()) break;
        await sleep(1000);
      }
    }
    if (entity.$owner?.toLowerCase() !== i.buyer.toLowerCase()) throw new Error("Arkiv: owner did not change to the buyer");
    if (entity.$creator?.toLowerCase() !== attestor.address.toLowerCase()) throw new Error("Arkiv: creator is not the attestor");
    if (!entity.$creationFlags?.readonly) throw new Error("Arkiv: entity is not readonly");
    return { entityKey: entityKey!, createTx, transferTx, created, transferred };
  });
}

export type ArkivReview = {
  key: Hex;
  owner: string;
  orderId: string;
  rating: number;
  createdAt: number;
  reviewerKey: string;
  payTx: string;
  text: string;
  /** Written with the DEV skip-World flag: not a verified human. */
  dev: boolean;
};

const textOf = (v: unknown): string => {
  if (typeof v === "string") return v.startsWith("0x") ? hexToString(v as Hex) : v;
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  return "";
};

/**
 * All reviews for a seller wallet that were created by the attestor and are readonly (anything else is ignored).
 * `ignoredNotReadonly` counts attestor-created rows that were not readonly (should be 0).
 */
export async function readSellerReviews(accessKey: string, attestor: Address, seller: Address) {
  const reader = arkivReader(accessKey);
  const rows: ArkivReview[] = [];
  let ignoredNotReadonly = 0;
  const PAGE = 100;
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const page = await reader
      .select({
        $key: true,
        $owner: true,
        $creator: true,
        $creationFlags: true,
        order_id: true,
        rating: true,
        created_at: true,
        reviewer_key: true,
        pay_tx: true,
        text: true,
      })
      .from(ReviewSchema)
      .createdBy(attestor)
      .where(eq("seller", addr(seller)))
      .limit(PAGE)
      .offset(offset)
      .fetch();
    for (const e of page.entities) {
      if (e.$creator?.toLowerCase() !== attestor.toLowerCase()) continue;
      if (!e.$creationFlags?.readonly) {
        ignoredNotReadonly++;
        continue;
      }
      const reviewerKey = String(e.reviewer_key.value);
      rows.push({
        key: e.$key as Hex,
        owner: String(e.$owner),
        orderId: String(e.order_id.value),
        rating: Number(e.rating.value),
        createdAt: Number(e.created_at.value),
        reviewerKey,
        payTx: String(e.pay_tx.value),
        text: textOf(e.text.value),
        dev: reviewerKey.startsWith(DEV_REVIEWER_PREFIX),
      });
    }
    if (page.entities.length + page.skipped < PAGE) break;
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);
  return { rows, ignoredNotReadonly };
}
