import { GnosisSigningStrategy } from "../gnosis";
import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SavebleDocument } from "../../../../metadata/metadataStore";
import { MultisigMetadata, TDeploy, TMultisigPhase } from "../../../../metadata/schema";
import { updateLatestDeploy } from "../../../../commands/deploy/cmd/utils";
import { overrideTxServiceUrlForChainId } from "./utils";
import { TSignatureRequest } from "../../../strategy";
import { MetaTransactionData, OperationType } from '@safe-global/types-kit';
import ora from "ora";
import chalk from "chalk";


export abstract class GnosisApiStrategy extends GnosisSigningStrategy {

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates} = await this.runForgeScript(pathToUpgrade);

        const multisigExecuteRequests = this.filterMultisigRequests(output);
        if (multisigExecuteRequests?.length != 1) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${multisigExecuteRequests?.length}.`);
        }

        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        const signer = await this.getSignerAddress();
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: await this.safeAddress.get()
        });
        
        const txn = await protocolKitOwner1.createTransaction({
            transactions: [
                {
                    to: to,
                    data,
                    value: value.toString(),
                    operation: OperationType.Call
                }
            ],
        })

        const prompt = ora(`Forming transaction...`);
        const spinner = prompt.start();
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        spinner.stop();

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
        multisigExecuteRequests.forEach(req => console.log(JSON.stringify(req, null, 2)));

        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
            txServiceUrl: overrideTxServiceUrlForChainId(this.deploy._.chainId),
        })

        const signer = await this.getSignerAddress();
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: await this.safeAddress.get()
        });

        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map<MetaTransactionData>(req => {
                return {
                    to: req.to,
                    data: req.data,
                    value: req.value.toString(),
                    operation: OperationType.Call
                };
            })
            ,
        })

        let prompt = ora(`Creating transaction...`);
        let spinner = prompt.start();
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        const version = await protocolKitOwner1.getContractVersion();
        spinner.stop();
        
        if (stateUpdates) {
            console.log(chalk.bold.underline(`Updated Environment: `));
            console.table(stateUpdates.map(mut => {return {name: mut.name, value: mut.value}}));
        }

        const senderSignature = await this.getSignature(version, txn)
        
        prompt = ora(`Sending transction to Gnosis SAFE UI...`);
        spinner = prompt.start();
        try {
            await apiKit.proposeTransaction({
                safeAddress: await this.safeAddress.get(),
                safeTransactionData: txn.data,
                safeTxHash: hash,
                senderAddress: signer,
                senderSignature,
            })
        } finally {
            spinner.stop();
        }

        return {
            output,
            safeAddress: await this.safeAddress.get() as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer,
            signature: senderSignature,
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