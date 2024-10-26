import SafeApiKit from "@safe-global/api-kit";
import Safe from '@safe-global/protocol-kit'
import { SafeTransaction } from '@safe-global/types-kit';
import { Strategy, TSignatureRequest } from "../strategy";
import { parseTuple } from "./utils";
import ora from "ora";
import * as prompts from '../../commands/prompts';
import { MultisigMetadata, TDeploy, TMultisigPhase } from "../../metadata/schema";
import { updateLatestDeploy } from "../../commands/deploy/cmd/utils";
import { SavebleDocument } from "../../metadata/metadataStore";

interface TGnosisBaseArgs {
    safeAddress: string;
    rpcUrl: string;
}

export abstract class GnosisSigningStrategy<T> extends Strategy<TGnosisBaseArgs & T> {

    abstract getSignature(safeVersion: string, txn: SafeTransaction): Promise<`0x${string}`>;
    abstract getSignerAddress(): Promise<`0x${string}`>;
    abstract promptSubStrategyArgs(): Promise<T>;

    public async promptArgs(): Promise<TGnosisBaseArgs & T> {
        const rpcUrl = await prompts.rpcUrl(this.deploy._.chainId);
        const safeAddress = await prompts.safeAddress();
        const baseArgs: TGnosisBaseArgs = {
            safeAddress: safeAddress!,
            rpcUrl: rpcUrl!,
        };
        const subcommandArgs = await this.promptSubStrategyArgs();
        return {
            ...baseArgs,
            ...subcommandArgs
        };
    }

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute(string)`, await this.pathToDeployParamters()];
    }
    
    async cancel(deploy: SavebleDocument<TDeploy>): Promise<void> {
        switch (deploy._.phase as TMultisigPhase) {
            case "multisig_start":
            case "multisig_wait_signers":
            case "multisig_execute": {
                // cancel the transaction.
                const metadata = deploy._.metadata[deploy._.segmentId] as MultisigMetadata;
                const rpcUrl = await prompts.rpcUrl(deploy._.chainId);
                const protocolKitOwner1 = await Safe.init({
                    provider: rpcUrl!,
                    signer: await this.getSignerAddress(),
                    safeAddress: metadata.multisig
                });

                const apiKit = new SafeApiKit({
                    chainId: BigInt(deploy._.chainId),
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
                    const all = await import('../strategies/strategies');
                    const strategy = all.all.find(s => new s(deploy, this.metatxn!).id === strategyId);
                    return new strategy!(deploy, this.metatxn);
                })();

                const rejectionTxn = await protocolKitOwner1.createRejectionTransaction(tx.nonce);
                const hash = await protocolKitOwner1.getTransactionHash(rejectionTxn) as `0x${string}`;
                const safeVersion = await protocolKitOwner1.getContractVersion();

                await apiKit.proposeTransaction({
                    safeAddress: metadata.multisig,
                    safeTransactionData: rejectionTxn.data,
                    safeTxHash: hash,
                    senderAddress: await (strategy as unknown as GnosisSigningStrategy<unknown>).getSignerAddress(),
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

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade);
        const safeTxn = parseTuple(output.returns['0'].value);
        if (safeTxn.length != 4) {
            throw new Error(`Got invalid output from forge. Expected 4 members, got ${safeTxn?.length}.`);
        }
        const [to, value, data, op] = safeTxn;
        const {safeAddress, rpcUrl} = await this.args();

        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
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
            safeAddress: safeAddress as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress,
            signature: senderSignature,
        }
    }
}