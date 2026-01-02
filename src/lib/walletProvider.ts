/**
 * Universal Wallet Provider
 * 
 * Provides consistent signer access across ALL wallet types:
 * - WalletConnect (QR code from PC to phone)
 * - Injected (MetaMask, Over Flex, Phantom)
 * - Coinbase Wallet
 * 
 * Uses Wagmi's walletClient first (which correctly handles WalletConnect),
 * falls back to window.ethereum only if walletClient unavailable.
 */

import { getWalletClient } from '@wagmi/core';
import { wagmiConfig } from '@/config/web3modal';
import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.overprotocol.com';

/**
 * Get a signer that works with ANY connected wallet type
 * This is the ONLY way to get a signer for transactions in the game
 */
export async function getUniversalSigner(): Promise<ethers.Signer> {
  // 1. Try Wagmi walletClient first (handles WalletConnect, injected, etc.)
  try {
    const client = await getWalletClient(wagmiConfig);
    if (client) {
      console.log('[walletProvider] Using Wagmi walletClient');
      const provider = new ethers.providers.Web3Provider(client as any, 'any');
      return provider.getSigner();
    }
  } catch (e) {
    console.warn('[walletProvider] Wagmi client not available:', e);
  }
  
  // 2. Fallback to window.ethereum (only for direct injected wallets)
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    console.log('[walletProvider] Falling back to window.ethereum');
    const provider = new ethers.providers.Web3Provider((window as any).ethereum, 'any');
    return provider.getSigner();
  }
  
  throw new Error('No wallet connected. Please connect your wallet first.');
}

/**
 * Get a read-only provider (no wallet required)
 * Use this for reading contract state without transactions
 */
export function getReadProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(RPC_URL);
}

/**
 * Check if a wallet is connected via Wagmi
 */
export async function isWalletConnected(): Promise<boolean> {
  try {
    const client = await getWalletClient(wagmiConfig);
    return !!client;
  } catch {
    return false;
  }
}
