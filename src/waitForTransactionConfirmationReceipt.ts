import { QueryClient } from '@tanstack/query-core';

import SafeApiKit from '@safe-global/api-kit';

import { waitForTransactionReceipt, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

import { isTransactionHashSafeWallet } from './isTransactionHashSafeWallet';

/**
 * Fetches a Safe Wallet transaction from the Safe API.
 *
 * @param hash - The hash of the transaction to fetch
 * @param wagmiConfig - The Wagmi configuration object
 * @returns The fetched Safe Wallet transaction
 */
const fetchSafeWalletTransaction = async (hash: Hash, wagmiConfig: Config) => {
  const chainId = getChainId(wagmiConfig);
  const safeApiKit = new SafeApiKit({
    chainId: BigInt(chainId),
  });
  const safeTransaction = await safeApiKit.getTransaction(hash);

  if (!safeTransaction.isExecuted) {
    throw new Error('Transaction not yet executed');
  }

  return safeTransaction;
};

/**
 * Polls the Safe Wallet API for a transaction until it is confirmed.
 *
 * Safe Wallet transactions that require multiple signatures won't be executed immediately.
 * This function continuously checks the Safe API until the transaction is fully executed.
 *
 * @param hash - The Safe transaction hash to poll
 * @param wagmiConfig - The Wagmi configuration object
 * @param delay - The base delay between polls in milliseconds (default: 5000ms)
 * @returns The confirmed Safe transaction data
 */
async function pollSafeWalletTransaction(hash: Hash, wagmiConfig: Config, delay = 5000) {
  const queryClient = new QueryClient();

  const result = await queryClient.fetchQuery({
    queryKey: ['safeTransaction', hash],
    queryFn: () => fetchSafeWalletTransaction(hash, wagmiConfig),
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
  });

  return result;
}

/**
 * Waits for a transaction to be confirmed, handling both regular and Safe Wallet transactions.
 *
 * This function provides a unified way to wait for transaction confirmation regardless of the transaction type:
 * - For Safe Wallet transactions: First monitors the Safe API for all required signatures, then waits for
 *   the actual on-chain execution to be confirmed
 * - For regular transactions: Simply waits for blockchain confirmation
 *
 * @param hash - The transaction hash to monitor
 * @param wagmiConfig - The Wagmi configuration object
 * @returns A promise that resolves to the final transaction hash
 */
export async function waitForTransactionConfirmationReceipt(hash: Hash, wagmiConfig: Config): Promise<Hash> {
  const isSafeWalletTransaction = await isTransactionHashSafeWallet(hash, wagmiConfig);

  // For Safe Wallet transactions, get the actual on-chain transaction hash
  const finalHash = isSafeWalletTransaction
    ? ((await pollSafeWalletTransaction(hash, wagmiConfig)).transactionHash as Hash)
    : hash;

  // Wait for on-chain confirmation with the appropriate hash
  await waitForTransactionReceipt(wagmiConfig, { hash: finalHash });
  return finalHash;
}
