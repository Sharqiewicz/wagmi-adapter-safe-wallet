import SafeApiKit from '@safe-global/api-kit';
import { QueryClient } from '@tanstack/query-core';
import { waitForTransactionReceipt, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

import { isTransactionHashSafeWallet } from './isTransactionHashSafeWallet';

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
 * If the transaction has to be signed by several signers, it may take some time for the transaction to be confirmed.
 * This function polls the Safe Wallet API for the transaction and returns the confirmed transaction.
 *
 * @param hash - The hash of the transaction to poll.
 * @param delay - The delay between polls in milliseconds.
 * @returns The confirmed transaction.
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
 * For Safe Wallet transactions, it monitors both the Safe API for signatures and the blockchain for confirmation.
 * For regular transactions, it simply waits for blockchain confirmation.
 *
 * @param hash - The transaction hash to monitor
 * @param wagmiConfig - The Wagmi configuration object
 * @returns A promise that resolves to the final transaction hash
 */
export async function waitForTransactionConfirmationReceipt(hash: Hash, wagmiConfig: Config): Promise<Hash> {
  const isSafeWalletTransaction = await isTransactionHashSafeWallet(hash, wagmiConfig);

  if (isSafeWalletTransaction) {
    // Wait for all required signatures via Safe API
    const safeTransaction = await pollSafeWalletTransaction(hash, wagmiConfig);
    const transactionHash = safeTransaction.transactionHash as Hash;

    // Wait for on-chain confirmation
    await waitForTransactionReceipt(wagmiConfig, { hash: transactionHash });
    return transactionHash;
  }

  await waitForTransactionReceipt(wagmiConfig, { hash });
  return hash;
}
