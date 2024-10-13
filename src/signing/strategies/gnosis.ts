import * as SafeApiKit from "@safe-global/api-kit";
import * as Safe from '@safe-global/protocol-kit'
import { SafeTransaction } from '@safe-global/types-kit';
import { Strategy, TSignatureRequest, Txn } from "../strategy.js";
import { parseTuple, parseTuples } from "./utils.js";

type TGnosisBaseArgs = {
    safeAddress: string;
    rpcUrl: string;
}

export abstract class GnosisSigningStrategy<T> extends Strategy<TGnosisBaseArgs & T> {

    abstract getSignature(safeVersion: string, txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<`0x${string}`>;
    abstract isValidSubCommandArgs(obj: any): obj is T;
    
    isValidArgs(obj: any): obj is TGnosisBaseArgs & T {
        return obj !== null && obj !== undefined && typeof obj.safeAddress == 'string' && obj.safeAddress && typeof obj.rpcUrl == 'string' && this.isValidSubCommandArgs(obj); 
    }

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute(string)`, await this.pathToDeployParamters()];
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const output = await this.runForgeScript(pathToUpgrade) as any;
        const safeTxn = parseTuple(output.output.returns['0'].value);
        if (safeTxn.length != 4) {
            // sanity check
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${safeTxn?.length}.`, output);
        }
        const [to, value, data, op] = safeTxn;
        const {safeAddress, rpcUrl} = this.args;

        // @ts-expect-error default imports are messed up with NodeNext
        const apiKit = new SafeApiKit.default({
            chainId: 1n, // TODO:(multinetwork)
            txServiceUrl: 'https://safe-transaction-mainnet.safe.global', // TODO:(multinetwork)
        })
        // @ts-expect-error default imports are messed up with NodeNext
        const protocolKitOwner1 = await Safe.default.init({
            provider: rpcUrl,
            signer: await this.getSignerAddress(),
            safeAddress: safeAddress
        })

        // TODO: we don't need to multi-encode this at the solidity level.
        const txn = await protocolKitOwner1.createTransaction({
            transactions: [
                {
                    to: to,
                    data,
                    value,
                    operation: parseInt(op)
                }
            ],
        })

        const hash = await protocolKitOwner1.getTransactionHash(txn)
        const version = await protocolKitOwner1.getContractVersion();

        const senderAddress = await this.getSignerAddress();
        const senderSignature = await this.getSignature(version, txn)

        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData: txn.data,
            safeTxHash: hash,
            senderAddress,
            senderSignature,
        })

        return {
            safeAddress,
            safeTxHash: hash,
            senderAddress,
            signature: senderSignature,
        }
    }

    latest(): Promise<TSignatureRequest> {
        // TODO:(milestone1): get the status of the latest signature request.
        throw new Error('unimplemented');
    }
}