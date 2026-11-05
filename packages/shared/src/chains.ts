import { defineChain } from "viem";

/** Whitechain Sepolia (OP Stack L2). Values from docs.whitechain.io/learn/network/reference (read 5 Nov 2026). */
export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.whitechain.io"],
      webSocket: ["wss://rpc.testnet.whitechain.io/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://explorer.testnet.whitechain.io" },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: true,
});

/**
 * Arkiv Rabdi testnet, for reference/display only. Server code should use
 * `rabdi({ accessKey })` from "@arkiv-network/sdk/chains", which appends the access key to the RPC URL.
 */
export const arkivRabdi = defineChain({
  id: 7794095,
  name: "Arkiv Rabdi",
  nativeCurrency: { name: "Test GLM", symbol: "tGLM", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.rabdi.db-chain.testnet.arkiv.network"],
      webSocket: ["wss://rpc.rabdi.db-chain.testnet.arkiv.network"],
    },
  },
  blockExplorers: {
    default: { name: "Arkiv Explorer", url: "https://rabdi.explorer.arkiv.network" },
  },
  testnet: true,
});

export const explorerTx = (hash: string) => `${whitechainSepolia.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (addr: string) =>
  `${whitechainSepolia.blockExplorers.default.url}/address/${addr}`;
