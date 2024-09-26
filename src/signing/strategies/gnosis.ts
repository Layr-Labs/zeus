import SafeApiKit from "@safe-global/api-kit";
import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";
import {privateKeyToAccount} from 'viem/accounts';

export class GnosisSigningStrategy extends SigningStrategy {
    id = "gnosis";

    async requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        const {safeAddress, sender} = this.options as Record<string, string>;

        const apiKit = new SafeApiKit.default({
            chainId: 1n,
        })

        const hash = ''; // TODO: what am i hashing lmao
        const safeTransactionData = { 
            operation: 0, // CALL
            safeTxGas: '1', // TODO:
            baseGas: '1', // TODO:
            gasPrice: '1', // TODO:
            gasToken: '',
            refundReceiver: '0x0', // TODO:;
            nonce: 0, // TODO:
            to: txns[0].to,
            value: '0',
            data: txns[0].calldata
        };

        const account = privateKeyToAccount(sender as `0x${string}`);

        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData,
            safeTxHash: hash,
            senderAddress: account.address,
            senderSignature: `0x` // TODO: is this an eip712 signature?
        })

        // TODO: store `safeTxHash` in ZEUS_HOST.
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }
}