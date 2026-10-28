import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const CHAIN_ID = "0xf22f";
export const NETWORK = {
  chainId: CHAIN_ID,
  chainName: "GenLayer Stable Studionet",
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://studio.genlayer.com/api"],
  blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
};

// Use standard EIP-1193 methods. SDK connect() additionally installs a
// MetaMask Snap, which is not needed for Studionet transactions.
export async function connectWallet(provider) {
  if (!provider?.request) throw new Error("No wallet found. Install an Ethereum-compatible wallet and reload.");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!/^0x[0-9a-f]{40}$/i.test(account || "")) throw new Error("No wallet account selected.");
  if (Number(await provider.request({ method: "eth_chainId" })) !== studionet.id) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
    } catch (err) {
      if (Number(err?.code ?? err?.data?.originalError?.code) !== 4902) throw err;
      await provider.request({ method: "wallet_addEthereumChain", params: [NETWORK] });
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
    }
  }
  if (Number(await provider.request({ method: "eth_chainId" })) !== studionet.id) {
    throw new Error("Switch your wallet to Stable Studionet (61999) and try again.");
  }
  const current = await provider.request({ method: "eth_accounts" });
  if (current?.[0]?.toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account changed. Connect again.");
  return { account, client: createClient({ chain: studionet, account, provider }) };
}

export function assertExecution(receipt) {
  if (receipt?.tx_execution_succeeded !== true) {
    throw new Error("Transaction finalized without confirmed successful execution. Check the transaction in the explorer before retrying.");
  }
}
