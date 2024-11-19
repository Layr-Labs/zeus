import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SafeTransaction } from '@safe-global/types-kit';
import { Strategy, TSignatureRequest } from "../../../strategy";
import { parseTuple } from "../../utils";
import ora from "ora";
import * as prompts from '../../../../commands/prompts';
import { MultisigMetadata, TDeploy, TMultisigPhase } from "../../../../metadata/schema";
import { updateLatestDeploy } from "../../../../commands/deploy/cmd/utils";
import { SavebleDocument } from "../../../../metadata/metadataStore";
import { holesky } from "viem/chains";

interface TGnosisBaseArgs {
    safeAddress: string;
    rpcUrl: string;
}

const TX_SERVICE_HOLESKY = 'https://gateway.holesky-safe.protofire.io';
// https://gateway.holesky-safe.protofire.io/v1/chains/17000/transactions/0x872Ac6896A7DCd3907704Fab60cc87ab7Cac6A9B/propose (this worked for holesky...)

export abstract class GnosisSigningStrategy<T> extends Strategy<TGnosisBaseArgs & T> {

    abstract getSignature(safeVersion: string, txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<`0x${string}`>;
    abstract promptSubStrategyArgs(): Promise<T>;

    public async promptArgs(): Promise<TGnosisBaseArgs & T> {
        const rpcUrl = await prompts.rpcUrl(this.deploy._.chainId);
        const safeAddress = await prompts.safeAddress();
        const baseArgs: TGnosisBaseArgs = {
            safeAddress: safeAddress,
            rpcUrl: rpcUrl,
        };
        const subcommandArgs = await this.promptSubStrategyArgs();
        return {
            ...baseArgs,
            ...subcommandArgs
        };
    }

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute()`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        return await this.forgeArgs();
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
                const rpcUrl = await prompts.rpcUrl(deploy._.chainId);
                const protocolKitOwner1 = await Safe.init({
                    provider: rpcUrl,
                    signer,
                    safeAddress: metadata.multisig
                });

                const overrideTxServiceUrl = deploy._.chainId === holesky.id ? TX_SERVICE_HOLESKY : undefined;
                const apiKit = new SafeApiKit({
                    chainId: BigInt(deploy._.chainId),
                    // TODO: we probably want the option to inject a custom tx service url here...
                    txServiceUrl: overrideTxServiceUrl,
                })
                const tx = await apiKit.getTransaction(metadata.gnosisTransactionHash);
                if (tx.isExecuted) {
                    throw new Error(`Cannot cancel, transaction ${tx.transactionHash} already executed.`);
                }

                // prompt for another strategy, which will be used to sign.
                console.log(`To cancel this transaction, you'll need to submit a rejection transaction to replace the current multisig txn.`)
                const strategyId = await prompts.pickStrategy([
                    {id: 'gnosis.eoa', description: 'EOA'},
                    {id: 'gnosis.ledger', description: 'Ledger'}
                ])

                const strategy = await (async () => {
                    const all = await import('../../strategies');
                    const strategy = all.all.find(s => new s(deploy, this.metatxn).id === strategyId);
                    if (!strategy) {
                        throw new Error(`Unknown strategy`);
                    }
                    return new strategy(deploy, this.metatxn);
                })();

                const rejectionTxn = await protocolKitOwner1.createRejectionTransaction(tx.nonce);
                const hash = await protocolKitOwner1.getTransactionHash(rejectionTxn) as `0x${string}`;
                const safeVersion = await protocolKitOwner1.getContractVersion();

                await apiKit.proposeTransaction({
                    safeAddress: metadata.multisig,
                    safeTransactionData: rejectionTxn.data,
                    safeTxHash: hash,
                    senderAddress: signer,
                    senderSignature: await (strategy as unknown as GnosisSigningStrategy<unknown>).getSignature(safeVersion, rejectionTxn),
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

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates} = await this.runForgeScript(pathToUpgrade);
        const safeTxn = parseTuple(output.returns['0'].value);
        if (safeTxn.length != 4) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${safeTxn?.length}.`);
        }
        const [to, value, data, op] = safeTxn;
        const {safeAddress, rpcUrl} = await this.args();

        const signer = await this.getSignerAddress();
        const protocolKitOwner1 = await Safe.init({
            provider: rpcUrl,
            signer,
            safeAddress: safeAddress
        });

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

        const prompt = ora(`Forming transaction...`);
        const spinner = prompt.start();
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        spinner.stop();

        return {
            safeAddress: safeAddress as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates
        }
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates} = await this.runForgeScript(pathToUpgrade);
        const safeTxn = parseTuple(output.returns['0'].value);
        if (safeTxn.length != 4) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${safeTxn?.length}.`);
        }
        const [to, value, data, op] = safeTxn;
        const {safeAddress, rpcUrl} = await this.args();
        const overrideTxServiceUrl = this.deploy._.chainId === holesky.id ? TX_SERVICE_HOLESKY : undefined;

        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
            txServiceUrl: overrideTxServiceUrl,
        })

        const signer = await this.getSignerAddress();
        const protocolKitOwner1 = await Safe.init({
            provider: rpcUrl,
            signer,
            safeAddress: safeAddress
        });

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
        spinner.stop();

        const senderSignature = await this.getSignature(version, txn)
        
        prompt = ora(`Sending transction to Gnosis SAFE UI...`);
        spinner = prompt.start();
        try {
            await apiKit.proposeTransaction({
                safeAddress,
                safeTransactionData: txn.data,
                safeTxHash: hash,
                senderAddress: signer,
                senderSignature,
            })
        } finally {
            spinner.stop();
        }

        return {
            safeAddress: safeAddress as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signer,
            signature: senderSignature,
            stateUpdates
        }
    }
}