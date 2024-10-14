import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SafeTransaction } from '@safe-global/types-kit';
import { Strategy, TSignatureRequest, Txn } from "../strategy";
import { parseTuple, parseTuples, SEPOLIA_CHAIN_ID } from "./utils";
import ora from "ora";

type TGnosisBaseArgs = {
    safeAddress: string;
    rpcUrl: string;
}

export abstract class GnosisSigningStrategy<T> extends Strategy<TGnosisBaseArgs & T> {

    abstract getSignature(safeVersion: string, txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<`0x${string}`>;
    abstract assertValidSubCommandArgs(obj: any): obj is T;
    
    assertValidArgs(obj: any): obj is TGnosisBaseArgs & T {
        this.assertValidSubCommandArgs(obj);
        if (!obj.safeAddress) {
            throw new Error(`Expected --safeAddress`);
        }
        if (!obj.rpcUrl) {
            throw new Error(`Expected --rpcUrl`);
        }
        return true;
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
            chainId: BigInt(SEPOLIA_CHAIN_ID), // TODO:(multinetwork)
        })

        const protocolKitOwner1 = await Safe.init({
            provider: rpcUrl,
            signer: await this.getSignerAddress(),
            safeAddress: safeAddress
        });

        // TODO:(low-pri) we don't need to multi-encode this at the solidity level.
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

        let prompt = ora(`Creating transaction...`);
        let spinner = prompt.start();

        const hash = await protocolKitOwner1.getTransactionHash(txn)
        const version = await protocolKitOwner1.getContractVersion();
        const senderAddress = await this.getSignerAddress();

        spinner.stop();

        prompt = ora(`Signing transaction...`);
        spinner = prompt.start();
        const senderSignature = await this.getSignature(version, txn)
        spinner.stop();
        
        prompt = ora(`Sending transction to Gnosis SAFE UI...`);
        spinner = prompt.start();
        await apiKit.proposeTransaction({
            safeAddress,
            safeTransactionData: txn.data,
            safeTxHash: hash,
            senderAddress,
            senderSignature,
        })
        spinner.stop();

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