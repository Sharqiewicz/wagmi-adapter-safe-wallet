import SafeApiKit from '@safe-global/api-kit';
import { getTransaction, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Determines if a transaction hash belongs to a Safe Wallet transaction or a regular Ethereum transaction.
 *
 * Safe Wallet transactions are not stored directly on the blockchain, but rather in Safe's API.
 * When querying the blockchain for a Safe transaction hash, it will return null since that hash only exists
 * in Safe's system until the transaction is executed.
 *
 * The function first attempts to find the transaction on the blockchain. If found, it's considered a regular
 * Ethereum transaction. If not found, it checks the Safe API to determine if it's a Safe Wallet transaction.
 *
 * Note: When a Safe Wallet has only 1 signer required, it behaves like a regular EOA (Externally Owned Account)
 * and will produce regular Ethereum transactions.
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
    // Transaction not found on chain, check if it's a Safe Wallet transaction
    const chainId = getChainId(wagmiConfig);
    const safeApiKit = new SafeApiKit({
      chainId: BigInt(chainId),
    });

    try {

      await safeApiKit.getTransaction(hash);

      return true;
    } catch (e) {
      // Wait for 1 second before retrying to help the node index the transaction
      await delay(1000);

      // Retry, maybe the node we're querying now has the transaction indexed
      return isTransactionHashSafeWallet(hash, wagmiConfig);
    }
  }
}