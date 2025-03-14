import { GnosisSigningStrategy } from "../gnosis";
import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SavebleDocument } from "../../../../metadata/metadataStore";
import { MultisigMetadata, TDeploy, TMultisigPhase } from "../../../../metadata/schema";
import { overrideTxServiceUrlForChainId } from "./utils";
import { TSignatureRequest } from "../../../strategy";
import { OperationType } from '@safe-global/types-kit';
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
        this.forMultisig = safeContext.addr;

        const signer = getAddress(await this.getSignerAddress());

        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        if (multisigExecuteRequests.length === 0) {
            console.warn(`This step returned no transactions. If this isn't intentional, consider cancelling your deploy.`);
            return {
                empty: true,
                safeAddress: getAddress(safeContext.addr),
                safeTxHash: undefined,
                senderAddress: signer as `0x${string}`,
                stateUpdates
            }
        }

        console.log(chalk.italic(`Upgrade script produced the following transactions: `))
        console.table(JSON.stringify(multisigExecuteRequests, null, 2));

        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: getAddress(safeContext.addr)
        });
        
        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map(({to, value, data}) => 
                ({
                    to: getAddress(to),
                    data,
                    value: hexToNumber(value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                })
            ),
        })

        const hash = await protocolKitOwner1.getTransactionHash(txn)

        return {
            empty: false,
            output,
            safeAddress: getAddress(safeContext.addr),
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
        this.forMultisig = safeContext.addr;
        const signer = getAddress(await this.getSignerAddress());

        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        multisigExecuteRequests.forEach(req => console.log(JSON.stringify(req, null, 2)));
        if (multisigExecuteRequests.length === 0) {
            console.warn(`This step returned no transactions. If this isn't intentional, consider cancelling your deploy.`);
            return {
                empty: true,
                safeAddress: getAddress(safeContext.addr),
                safeTxHash: undefined,
                senderAddress: signer as `0x${string}`,
                stateUpdates
            }
        }

        console.log(`Multisig transaction to execute: `)
        console.table(JSON.stringify(multisigExecuteRequests, null, 2));
        
        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
            txServiceUrl: overrideTxServiceUrlForChainId(this.deploy._.chainId),
        })

        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: getAddress(safeContext.addr)
        });

        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map(({to, value, data}) => 
                ({
                    to: getAddress(to),
                    data,
                    value: hexToNumber(value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                })
            ),
        })

        console.log(`Creating transaction...`);
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        const version = await protocolKitOwner1.getContractVersion();
        
        if (stateUpdates) {
            console.log(chalk.bold.underline(`Updated Environment: `));
            console.table(stateUpdates.map(mut => {return {name: mut.name, value: mut.value}}));
        }

        const senderSignature = await this.getSignature(version, txn, safeContext.addr)

        console.log(`Signature requested: ${senderSignature}`);
        
        await apiKit.proposeTransaction({
            safeAddress: getAddress(safeContext.addr),
            safeTransactionData: txn.data,
            safeTxHash: hash,
            senderAddress: getAddress(signer),
            senderSignature,
        })

        return {
            empty: false,
            output,
            safeAddress: safeContext.addr,
            safeTxHash: hash as `0x${string}`,
            senderAddress: getAddress(signer),
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