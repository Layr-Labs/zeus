import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";
import {privateKeyToAccount} from 'viem/accounts';

export class GnosisSigningStrategy extends SigningStrategy {
    id = "gnosis.eoa";

    async requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        const {safeAddress, sender, rpcUrl} = this.options as Record<string, string>;
        const account = privateKeyToAccount(sender as `0x${string}`);
        const apiKit = new SafeApiKit.default({
            chainId: 1n,
            txServiceUrl: 'https://safe-transaction-mainnet.safe.global',
        })

        const protocolKitOwner1 = await Safe.default.init({
            provider: rpcUrl,
            signer: sender,
            safeAddress: safeAddress
          })

        const txn = await protocolKitOwner1.createTransaction({
            transactions: txns.map((txn) => {
            return {
                to: txn.to,
                data: txn.calldata,
                value: '0'
            }
            }),
        })
        const txnHash = await protocolKitOwner1.getTransactionHash(txn);
        const signature = await protocolKitOwner1.signHash(txnHash);
        
        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData: txn.data,
            safeTxHash: txnHash,
            senderAddress: account.address,
            senderSignature: signature.data,
        })

        // TODO: store `safeTxHash` in ZEUS_HOST.
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }
}