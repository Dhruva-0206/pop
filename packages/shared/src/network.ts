import { defineChain, type Chain } from "viem";
import { whitechainSepolia } from "./chains";

/**
 * ONE switch: NETWORK_MODE=fork|testnet.
 * - fork: a LOCAL anvil fork of Whitechain Sepolia state (real USDT bytecode) running with chain id 31337,
 *   so nothing signed on the fork can ever be replayed on the real chain 1874.
 *   Balances are written by local scripts. Nothing there is a real payment; the UI labels it "LOCAL FORK".
 * - testnet: the real Whitechain Sepolia.
 */
export type NetworkMode = "fork" | "testnet";

export function parseMode(v: string | undefined): NetworkMode {
  return v === "testnet" ? "testnet" : "fork";
}

export const FORK_CHAIN_ID = 31337;

export function networkFor(mode: NetworkMode, forkRpcUrl = "http://127.0.0.1:8545", testnetRpcUrl?: string) {
  const rpcUrl = mode === "fork" ? forkRpcUrl : testnetRpcUrl || whitechainSepolia.rpcUrls.default.http[0];
  const chain: Chain =
    mode === "fork"
      ? defineChain({
          ...whitechainSepolia,
          id: FORK_CHAIN_ID,
          name: "Whitechain Sepolia (LOCAL FORK)",
          rpcUrls: { default: { http: [rpcUrl] } },
          blockExplorers: undefined,
        })
      : defineChain({ ...whitechainSepolia, rpcUrls: { default: { http: [rpcUrl] } } });
  const explorer = mode === "fork" ? undefined : whitechainSepolia.blockExplorers.default.url;
  return {
    mode,
    chain,
    rpcUrl,
    isLocalFork: mode === "fork",
    label: mode === "fork" ? "LOCAL FORK · not a real payment" : "Whitechain Sepolia testnet",
    txUrl: (hash: string) => (explorer ? `${explorer}/tx/${hash}` : undefined),
    addressUrl: (a: string) => (explorer ? `${explorer}/address/${a}` : undefined),
  };
}
export type Network = ReturnType<typeof networkFor>;

/** Deployed addresses per mode (written by scripts/deploy.ts into deployments/<mode>.json). */
export type Deployment = {
  mode: NetworkMode;
  chainId: number;
  registry: `0x${string}`;
  checkout: `0x${string}`;
  token: `0x${string}`;
  tokenDecimals: number;
  deployBlock: string;
  deployedAt: string;
};
