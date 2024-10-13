import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SafeTransaction } from '@safe-global/types-kit';
import { Strategy, TSignatureRequest, Txn } from "../strategy";
import { parseTuple, parseTuples } from "./utils";

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

        const apiKit = new SafeApiKit({
            chainId: 1n, // TODO:(multinetwork)
            txServiceUrl: 'https://safe-transaction-mainnet.safe.global', // TODO:(multinetwork)
        })

        const protocolKitOwner1 = await Safe.init({
            provider: rpcUrl,
            signer: await this.getSignerAddress(),
            safeAddress: safeAddress
        });

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

        console.log(`creating txn hash...`);
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        console.log(hash);
        const version = await protocolKitOwner1.getContractVersion();
        const senderAddress = await this.getSignerAddress();

        console.log(`signing txn hash (${version})...`);
        const senderSignature = await this.getSignature(version, txn)
        console.log(senderSignature);

        console.log(`proposing txn...`);
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