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

    abstract getSignature(safeVersion: string, txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<string>;
    abstract isValidSubCommandArgs(obj: any): obj is T;
    
    isValidArgs(obj: any): obj is TGnosisBaseArgs & T {
        return obj !== null && obj !== undefined && typeof obj.safeAddress == 'string' && typeof obj.rpcUrl == 'string' && this.isValidSubCommandArgs(obj); 
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        var txns: Txn[] = [];

        const {safeAddress, rpcUrl} = this.args;
        const apiKit = new SafeApiKit.default({
            chainId: 1n, // TODO:(multinetwork)
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

        const hash = await protocolKitOwner1.getTransactionHash(txn)
        const version = await protocolKitOwner1.getContractVersion();

        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData: txn.data,
            safeTxHash: hash,
            senderAddress: await this.getSignerAddress(),
            senderSignature: await this.getSignature(version, txn),
        })

        // TODO:(milestone1) store `safeTxHash` in ZEUS_HOST.
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest> {
        // TODO:(milestone1): get the status of the latest signature request.
        throw new Error('unimplemented');
    }
}