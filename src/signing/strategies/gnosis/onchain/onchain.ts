import ora from "ora";
import {abi} from './Safe';
import { ICachedArg, TSignatureRequest } from "../../../strategy";
import { GnosisSigningStrategy } from "../gnosis";
import { getContract } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import { privateKey } from "../../../../commands/prompts";

export abstract class GnosisOnchainStrategy extends GnosisSigningStrategy {

    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, defaultArgs?: Record<string, unknown>) {
        super(deploy, transaction, defaultArgs);
        this.privateKey = this.arg(async () => await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE'))
    } 


    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates} = await this.runForgeScript(pathToUpgrade);

        const multisigExecuteRequests = this.filterMultisigRequests(output);
        if (multisigExecuteRequests?.length != 1) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${multisigExecuteRequests?.length}.`);
        }

        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        const safe = getContract({abi, address: await this.safeAddress.get(), client: walletClient});


        const signer = await this.getSignerAddress();
       
        // TODO: compute hash of txn
        const hash = '0x';

        return {
            output,
            safeAddress: await this.safeAddress.get() as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates
        }
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates} = await this.runForgeScript(pathToUpgrade);

        const multisigExecuteRequests = this.filterMultisigRequests(output);
        if (multisigExecuteRequests?.length != 1) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${multisigExecuteRequests?.length}.`);
        }

        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        const signer = await this.getSignerAddress();
       
        // TODO: compute hash of txn
        const hash = '0x';

        // TODO: propose txn onchain

        return {
            output,
            safeAddress: await this.safeAddress.get() as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates
        }
    }


    async cancel(deploy: SavebleDocument<TDeploy>): Promise<void> {
        switch (deploy._.phase as TMultisigPhase) {
            case "multisig_start":
            case "multisig_wait_signers":
            case "multisig_execute": {
                // cancel the transaction.
                const metadata = deploy._.metadata[deploy._.segmentId] as MultisigMetadata;
                if (!metadata || Object.keys(metadata).length === 0) {
                    console.log(`Cancelling deploy.`);
                    await updateLatestDeploy(this.metatxn, deploy._.env, undefined, true); // cancel the deploy.
                    return;
                }
                const signer = await this.getSignerAddress();
                const rpcUrl = await this.rpcUrl.get();
                const protocolKitOwner1 = await Safe.init({
                    provider: rpcUrl,
                    signer,
                    safeAddress: metadata.multisig
                });

                const apiKit = new SafeApiKit({
                    chainId: BigInt(deploy._.chainId),
                    txServiceUrl: overrideTxServiceUrlForChainId(deploy._.chainId), // TODO: we probably want the option to inject a custom tx service url here...
                })
                const tx = await apiKit.getTransaction(metadata.gnosisTransactionHash);
                if (tx.isExecuted) {
                    throw new Error(`Cannot cancel, transaction ${tx.transactionHash} already executed.`);
                }

                // prompt for another strategy, which will be used to sign.
                console.log(`To cancel this transaction, you'll need to submit a rejection transaction to replace the current multisig txn.`)

                const rejectionTxn = await protocolKitOwner1.createRejectionTransaction(tx.nonce);
                const hash = await protocolKitOwner1.getTransactionHash(rejectionTxn) as `0x${string}`;
                const safeVersion = await protocolKitOwner1.getContractVersion();

                await apiKit.proposeTransaction({
                    safeAddress: metadata.multisig,
                    safeTransactionData: rejectionTxn.data,
                    safeTxHash: hash,
                    senderAddress: signer,
                    senderSignature: await this.getSignature(safeVersion, rejectionTxn),
                })
                
                // TODO: there should be a "pending cancellation" phase.
                deploy._.phase = 'cancelled';
                (deploy._.metadata[deploy._.segmentId] as MultisigMetadata).cancellationTransactionHash = hash;
                await updateLatestDeploy(this.metatxn, deploy._.env, undefined, true); // cancel the deploy.
                return;
            }
            case "multisig_wait_confirm":
                throw new Error('transaction is already awaiting confirmation. cannot be cancelled.');
            default:
                break;
        }

        throw new Error('uncancellable.');
    }
}