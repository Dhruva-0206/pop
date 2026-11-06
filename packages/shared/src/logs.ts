/**
 * The Whitechain RPC rejects eth_getLogs over more than 10,000 blocks ("query exceeds max block range 10000"). Any query that
 * starts at the deploy block works for a few hours and then fails for good, so ALL event reads go through this helper:
 * it splits [from, to] into ranges of at most `maxRange` blocks (default 9,000) and concatenates the results in order.
 */
export async function chunkedLogs<T>(
  from: bigint,
  to: bigint,
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  maxRange: bigint = BigInt(9000),
): Promise<T[]> {
  const out: T[] = [];
  for (let f = from; f <= to; f += maxRange) {
    const t = f + maxRange - BigInt(1) < to ? f + maxRange - BigInt(1) : to;
    out.push(...(await fetchRange(f, t)));
  }
  return out;
}
