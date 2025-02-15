import SafeApiKit from '@safe-global/api-kit';
import { waitForTransactionReceipt, getChainId } from '@wagmi/core';
import type { Config } from '@wagmi/core';
import type { Hash } from 'viem';

import { isTransactionHashSafeWallet } from './isTransactionHashSafeWallet';


/**
 * If the transaction has to be signed by several signers, it may take some time for the transaction to be confirmed.
 * This function polls the Safe Wallet API for the transaction and returns the confirmed transaction.
 *
 * @param hash - The hash of the transaction to poll.
 * @param delay - The delay between polls in milliseconds.
 * @returns The confirmed transaction.
 */
async function pollSafeTransaction(hash: Hash, wagmiConfig: Config, delay = 5000) {
    const chainId = getChainId(wagmiConfig);
    const safeApiKit = new SafeApiKit({
      chainId: BigInt(chainId),
    });

    const safeTransaction = await safeApiKit.getTransaction(hash);

    if (safeTransaction.isExecuted) {
      return safeTransaction;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    return pollSafeTransaction(hash, wagmiConfig, delay);
}


/**
 * Detects if a transaction is a Safe Wallet transaction and waits for it to be confirmed by the Safe Wallet API and the blockchain.
 *
 * @param transactionHash - The hash of the transaction to wait for.
 * @returns The confirmed transaction hash.
 */
export async function waitForTransactionConfirmationReceipt(transactionHash: Hash, wagmiConfig: Config): Promise<Hash> {
  const isSafeWalletTransaction = await isTransactionHashSafeWallet(transactionHash, wagmiConfig);

  if (isSafeWalletTransaction) {
    // Wait for the transaction to be confirmed by the Safe Wallet API
    const safeTransaction = await pollSafeTransaction(transactionHash, wagmiConfig);
    const confirmedHash = safeTransaction.transactionHash as Hash;

    // Wait for the transaction to be confirmed by the blockchain
    await waitForTransactionReceipt(wagmiConfig, { hash: confirmedHash });
    return confirmedHash;
  }

  await waitForTransactionReceipt(wagmiConfig, { hash: transactionHash });
  return transactionHash;
}
