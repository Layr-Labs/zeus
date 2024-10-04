import SafeApiKit from "@safe-global/api-kit";
import {SafeTransaction} from "@safe-global/safe-core-sdk-types";
import Safe from '@safe-global/protocol-kit'
import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";
import {privateKeyToAccount} from 'viem/accounts';

type TGnosisBaseArgs = {
    safeAddress: string;
    rpcUrl: string;
}

export abstract class GnosisSigningStrategy<T> extends SigningStrategy<TGnosisBaseArgs & T> {

    abstract getTransactionHash(txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignature(txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<string>;

    abstract isValidSubCommandArgs(obj: any): obj is T;
    isValidArgs(obj: any): obj is TGnosisBaseArgs & T {
        return obj !== null && obj !== undefined && typeof obj.safeAddress == 'string' && typeof obj.rpcUrl == 'string' && this.isValidSubCommandArgs(obj); 
    }

    async requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        const {safeAddress, rpcUrl} = this.args;
        const apiKit = new SafeApiKit.default({
            chainId: 1n,
            txServiceUrl: 'https://safe-transaction-mainnet.safe.global',
        })
        const protocolKitOwner1 = await Safe.default.init({
            provider: rpcUrl,
            signer: await this.getSignerAddress(),
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
        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData: txn.data,
            safeTxHash: await this.getTransactionHash(txn),
            senderAddress: await this.getSignerAddress(),
            senderSignature: await this.getSignature(txn),
        })

        // TODO: store `safeTxHash` in ZEUS_HOST.
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }
}