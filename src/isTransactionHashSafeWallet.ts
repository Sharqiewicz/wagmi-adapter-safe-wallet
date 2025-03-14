import { QueryClient } from '@tanstack/query-core';

import SafeApiKit from '@safe-global/api-kit';

import { getTransaction, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

/**
 * Checks if a transaction exists on the blockchain.
 *
 * @param hash - Transaction hash to check
 * @param wagmiConfig - Wagmi configuration
 * @returns true if transaction exists on-chain, false otherwise
 */
async function isTransactionOnChain(hash: Hash, wagmiConfig: Config): Promise<boolean> {
  try {
    await getTransaction(wagmiConfig, { hash });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a transaction exists in the Safe Wallet API.
 *
 * @param hash - Transaction hash to check
 * @param wagmiConfig - Wagmi configuration
 * @returns The Safe transaction data if found
 */
async function checkSafeWalletTransaction(hash: Hash, wagmiConfig: Config) {
  const chainId = getChainId(wagmiConfig);
  const safeApiKit = new SafeApiKit({
    chainId: BigInt(chainId),
  });

  const transaction = await safeApiKit.getTransaction(hash);
  return transaction;
}

/**
 * Checks if a transaction exists in the Safe Wallet API with retry logic.
 *
 * @param hash - Transaction hash to check
 * @param wagmiConfig - Wagmi configuration
 * @returns true if transaction exists in Safe API, false otherwise
 */
async function isTransactionInSafeWalletApi(hash: Hash, wagmiConfig: Config): Promise<boolean> {
  const queryClient = new QueryClient();

  try {
    const result = await queryClient.fetchQuery({
      queryKey: ['safeTransaction', 'check', hash],
      queryFn: () => checkSafeWalletTransaction(hash, wagmiConfig),
      retry: 14,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    });

    return !!result;
  } catch (error) {
    return false;
  }
}

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
export async function isTransactionHashSafeWallet(hash: Hash, wagmiConfig: Config): Promise<boolean> {
  const onChain = await isTransactionOnChain(hash, wagmiConfig);

  if (onChain) {
    return false;
  }

  return await isTransactionInSafeWalletApi(hash, wagmiConfig);
}
