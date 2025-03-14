import { QueryClient } from '@tanstack/query-core';

import SafeApiKit from '@safe-global/api-kit';

import { getTransaction, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

/**
 * Checks if a transaction hash exists in the Safe Wallet API.
 *
 * @param hash - The transaction hash to check
 * @param wagmiConfig - The Wagmi configuration object
 * @returns The Safe transaction data if found
 */
const checkSafeTransaction = async (hash: Hash, wagmiConfig: Config) => {
  // Transaction not found on chain, check if it's a Safe Wallet transaction
  const chainId = getChainId(wagmiConfig);
  const safeApiKit = new SafeApiKit({
    chainId: BigInt(chainId),
  });

  const transaction = await safeApiKit.getTransaction(hash);

  return transaction;
};

/**
 * Determines if a transaction hash belongs to a Safe Wallet transaction or a regular Ethereum transaction.
 *
 * Safe Wallet transactions are not stored directly on the blockchain, but rather in Safe's API.
 * When querying the blockchain for a Safe transaction hash, it will return null since that hash only exists
 * in Safe's system until the transaction is executed.
 *
 * How this function works:
 * 1. First attempts to find the transaction on the blockchain using `getTransaction`
 * 2. If found on-chain, returns false (it's a regular on-chain transaction)
 * 3. If not found on-chain, queries the Safe API to check if it exists there
 * 4. If found in Safe API, returns true (it's a Safe Wallet transaction)
 * 5. If not found in either place, returns false - it's on-chain transaction that hasn't been indexed yet
 *
 * Important notes:
 * - Safe Wallet transactions with only 1 required signer behave like regular EOAs and produce standard
 *   on-chain transactions that will be found on-chain
 * - A transaction not found on-chain could be either a pending Safe transaction or simply not indexed yet
 * - The function uses retry logic when checking the Safe API to handle potential network issues
 *
 * @param hash - The transaction hash to check
 * @param wagmiConfig - The Wagmi configuration object
 * @returns true if this is a Safe Wallet transaction, false if it's a regular Ethereum transaction
 */
export async function isTransactionHashSafeWallet(hash: Hash, wagmiConfig: Config) {
  try {
    // Try to find the transaction on the blockchain
    // If found, it's a regular Ethereum transaction
    // If not found it throws an error, it might be a Safe Wallet transaction that hasn't been executed yet
    await getTransaction(wagmiConfig, { hash });

    // Transaction found on chain, so it's a regular Ethereum transaction
    // Note: If a transaction isn't found, it could be a Safe transaction or just not indexed by the node yet
    return false;
  } catch (error) {
    try {
      const queryClient = new QueryClient();

      const result = await queryClient.fetchQuery({
        queryKey: ['safeTransaction', 'check', hash],
        queryFn: () => checkSafeTransaction(hash, wagmiConfig),
        retry: 14,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      });

      if (result) {
        return true;
      }

      return false;
    } catch (e) {
      // After all retries, if we still can't find it in Safe API,
      // it's likely not a Safe transaction
      return false;
    }
  }
}
