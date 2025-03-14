# wagmi-adapter-safe-wallet

[![npm version](https://img.shields.io/npm/v/wagmi-adapter-safe-wallet.svg)](https://www.npmjs.com/package/wagmi-adapter-safe-wallet)

---

The issue: When using **Safe Wallet**, the initial transaction hash returned is a `safeTxHash` which differs from the final on-chain transaction hash. This is because Safe uses a multi-signature approach where:

1. The initial `safeTxHash` is generated when a transaction is proposed
2. This transaction needs to be confirmed by the required number of owners (based on the threshold)
3. Only after sufficient confirmations and execution will there be an actual on-chain transaction with a different hash

This creates challenges when tracking transaction status using standard wagmi/viem hooks, as they look for the initial `safeTxHash` on-chain which doesn't exist.

wagmi doesn't account for safe's safeTxHash

---
A utility library for handling Account Abstraction wallet transactions in wagmi, with initial support for **Safe Wallet**. Provides transaction hash resolution and confirmation tracking for Smart Contract Wallets where transaction hashes may not directly correspond to on-chain transactions.

Features:
- Detection of **Safe Wallet** transactions vs regular EOA transactions
- Smart polling of **Safe API** for multi-signature transaction confirmation
- Compatible with **wagmi** hooks & **viem**
- Handles both direct blockchain transactions and **Safe's API**

## Installation

```bash
npm i wagmi-adapter-safe-wallet
```

## Usage

### Detecting Safe Wallet Transactions

```ts
import { isTransactionHashSafeWallet } from 'wagmi-adapter-safe-wallet';

const isSafe = await isTransactionHashSafeWallet(hash, wagmiConfig);
```

### Waiting for Transaction Confirmation

instead of **wagmi**'s `waitForTransactionReceipt` you can use `waitForTransactionConfirmationReceipt`

```ts
import { waitForTransactionConfirmationReceipt } from 'wagmi-adapter-safe-wallet';

const receipt = await waitForTransactionConfirmationReceipt(hash, wagmiConfig);
```


## References
- https://github.com/wevm/wagmi/discussions/3463


- https://github.com/reown-com/appkit/issues/2517#issuecomment-2580047696

- https://ethereum.stackexchange.com/questions/165473/safe-connector-with-wagmi-library

- https://ethereum.stackexchange.com/questions/155384/how-to-get-receipt-in-wagmi-viem-for-a-transaction-issued-with-safe-on-walletc

- https://eips.ethereum.org/EIPS/eip-4337