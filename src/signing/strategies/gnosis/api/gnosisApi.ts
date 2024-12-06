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
import { getAddress, hexToNumber } from "viem";
import { SafeTransaction } from '@safe-global/types-kit';


export abstract class GnosisApiStrategy extends GnosisSigningStrategy {

    abstract getSignature(safeVersion: string, txn: SafeTransaction, safeAddress: `0x${string}`): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<`0x${string}`>;

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates, safeContext} = await this.runForgeScript(pathToUpgrade);
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }

        const multisigExecuteRequests = this.filterMultisigRequests(output);
        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        const signer = getAddress(await this.getSignerAddress());
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: getAddress(safeContext.addr)
        });
        
        const txn = await protocolKitOwner1.createTransaction({
            transactions: [
                {
                    to: getAddress(to),
                    data,
                    value: hexToNumber(value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                }
            ],
        })

        const prompt = ora(`Forming transaction...`);
        const spinner = prompt.start();
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        spinner.stop();

        return {
            output,
            safeAddress: safeContext.addr,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates
        }
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates, safeContext} = await this.runForgeScript(pathToUpgrade);
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }

        const multisigExecuteRequests = this.filterMultisigRequests(output);
        multisigExecuteRequests.forEach(req => console.log(JSON.stringify(req, null, 2)));

        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
            txServiceUrl: overrideTxServiceUrlForChainId(this.deploy._.chainId),
        })

        const signer = getAddress(await this.getSignerAddress());
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: getAddress(safeContext.addr)
        });

        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map<MetaTransactionData>(req => {
                return {
                    to: getAddress(req.to),
                    data: req.data,
                    value: hexToNumber(req.value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                };
            })
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

        const senderSignature = await this.getSignature(version, txn, safeContext.addr)
        
        prompt = ora(`Sending transction to Gnosis SAFE UI... (safe=${ getAddress(safeContext.addr)})`);
        spinner = prompt.start();
        try {
            await apiKit.proposeTransaction({
                safeAddress: getAddress(safeContext.addr),
                safeTransactionData: txn.data,
                safeTxHash: hash,
                senderAddress: getAddress(signer),
                senderSignature,
            })
        } finally {
            spinner.stop();
        }

        return {
            output,
            safeAddress: safeContext.addr,
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
                    senderSignature: await this.getSignature(safeVersion, rejectionTxn, metadata.multisig),
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