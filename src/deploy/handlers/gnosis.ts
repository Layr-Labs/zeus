
import { join } from "path";
import { existsSync } from "fs";
import ora from "ora";
import chalk from "chalk";
import { createPublicClient, http } from "viem";
const {default: SafeApiKit} = await import(`@safe-global/api-kit`)
import { SafeMultisigTransactionResponse} from '@safe-global/types-kit';
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { HaltDeployError, TGnosisRequest, TStrategyOptions } from "../../signing/strategy";
import { GnosisSigningStrategy } from "../../signing/strategies/gnosis/gnosis";
import { GnosisOnchainStrategy } from "../../signing/strategies/gnosis/onchain/onchain";
import { MultisigMetadata, TDeploy, TDeployStateMutations, TMutation, TTestOutput } from "../../metadata/schema";
import { advance, advanceSegment, getChain, isTerminalPhase } from "../../commands/deploy/cmd/utils";
import { injectableEnvForEnvironment } from "../../commands/run";
import { canonicalPaths } from "../../metadata/paths";
import { multisigBaseUrl, overrideTxServiceUrlForChainId } from "../../signing/strategies/gnosis/api/utils";
import { PhaseTypeHandler } from "./base";
import { promptForStrategy, promptForStrategyWithOptions } from "../../commands/deploy/cmd/utils-strategies";
import { runTest } from "../../signing/strategies/test";
import * as prompts from '../../commands/prompts';

export async function executeMultisigPhase(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, options: TStrategyOptions | undefined): Promise<void> {
    let multisigStrategy: GnosisSigningStrategy | undefined = undefined;

    if (options?.nonInteractive || options?.defaultArgs?.fork) {
        multisigStrategy = new GnosisOnchainStrategy(deploy, metatxn, {defaultArgs: options, nonInteractive: true});
    }   

    const rpcUrl = await (async () => {
        if (options?.defaultArgs?.rpcUrl) {
            return options?.defaultArgs?.rpcUrl;
        }
        return await prompts.rpcUrl(deploy._.chainId);
    })();

    switch (deploy._.phase) {
        case "multisig_start": {         
            const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);  
            // `gnosis.api` + `gnosis.onchain`.     
            if (existsSync(script)) {
                const prompt = ora(`Running 'zeus test'`);
                const spinner = prompt.start();
                try {
                    const res = await runTest({upgradePath: script, rpcUrl, txn: metatxn, context: {env: deploy._.env, deploy: deploy._.name}, verbose: false, json: true})
                    if (res.code !== 0) {
                        throw new HaltDeployError(deploy, `One or more tests failed.`, false);
                    }
                    
                    const testOutput = await metatxn.getJSONFile<TTestOutput>(canonicalPaths.testRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                    testOutput._ = res;
                    await testOutput.save();
                    spinner.stopAndPersist({prefixText: '✔'});
                } catch (e) {
                    spinner.stopAndPersist({prefixText: '❌'})
                    console.error(e);
                    throw e;
                }
                
                multisigStrategy = multisigStrategy ?? (await promptForStrategy(deploy, metatxn) as GnosisSigningStrategy);
                const sigRequest = await multisigStrategy.requestNew(script, deploy._) as TGnosisRequest;
                deploy._.metadata[deploy._.segmentId] = {
                    type: "multisig",
                    signer: sigRequest.senderAddress,
                    signerType: multisigStrategy.id,
                    gnosisTransactionHash: sigRequest.safeTxHash as `0x${string}`,
                    gnosisCalldata: undefined, // ommitting this so that a third party can't execute immediately.
                    multisig: sigRequest.safeAddress,
                    confirmed: false,
                    cancellationTransactionHash: undefined
                };

                if (sigRequest.immediateExecution && !sigRequest.immediateExecution.success) {
                    console.error(`This strategy attempted to immediately execute your request. It was unsuccessful. (${sigRequest.immediateExecution.transaction})`);
                    throw new HaltDeployError(deploy, `the onchain execution failed: ${JSON.stringify(sigRequest.immediateExecution, null, 2)}`)
                }

                if (sigRequest.stateUpdates && Object.keys(sigRequest.stateUpdates).length > 0) {
                    console.log(chalk.bold.underline(`Updated Environment: `));
                    console.table(sigRequest.stateUpdates.map(mut => {return {name: mut.name, value: mut.value}}));
                    
                    // save environment updates.
                    const currentEnv = await injectableEnvForEnvironment(metatxn, deploy._.env, deploy._.name);
                    const deployStateMutations = await metatxn.getJSONFile<TDeployStateMutations>(canonicalPaths.deployStateMutations(deploy._));
                    deployStateMutations._.mutations = [
                        ...(deployStateMutations._.mutations ?? []),
                        ...sigRequest.stateUpdates.map<TMutation>(mut => {
                            return {
                                prev: currentEnv[`ZEUS_ENV_${mut.name}`],
                                next: mut.value,
                                name: mut.name,
                                internalType: mut.internalType
                            }
                        })
                    ];
                    await deployStateMutations.save();
                }

                const multisigRun = await metatxn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                multisigRun._ = sigRequest;
                await multisigRun.save();

                if (sigRequest.immediateExecution && sigRequest.immediateExecution.transaction) {
                    (deploy._.metadata[deploy._.segmentId] as MultisigMetadata).confirmed = true;
                    (deploy._.metadata[deploy._.segmentId] as MultisigMetadata).immediateExecutionHash = sigRequest.immediateExecution.transaction;
                    console.log(`Transaction recorded: ${sigRequest.immediateExecution.transaction}`)
                    await advanceSegment(deploy);
                    await deploy.save();
                    await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction completed instantly`);
                } else {
                    await advance(deploy);
                    await deploy.save();
                    await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction started`);
                }
            } else {
                throw new HaltDeployError(deploy, `Missing expected script: ${script}. Please check your local copy and try again.`)
            }
            break;
        }
        case "multisig_wait_signers": {
            // `gnosis.api` only.
            const multisigDeploy = await metatxn.getJSONFile<TGnosisRequest>(
                canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
            )
            const safeApi = new SafeApiKit({chainId: BigInt(deploy._.chainId), txServiceUrl: overrideTxServiceUrlForChainId(deploy._.chainId)})
            const multisigTxn = await safeApi.getTransaction(multisigDeploy._.safeTxHash);

            if (multisigTxn.confirmations?.length === multisigTxn.confirmationsRequired) {
                console.log(chalk.green(`SafeTxn(${multisigDeploy._.safeTxHash}): ${multisigTxn.confirmations?.length}/${multisigTxn.confirmationsRequired} confirmations received!`))
                await advance(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction signers found`);
            } else {
                console.error(`Waiting on ${multisigTxn.confirmationsRequired - (multisigTxn.confirmations?.length ?? 0)} more confirmations. `)
                console.error(`\tShare the following URI: ${multisigBaseUrl(deploy._.chainId)}/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                console.error(`Run the following to continue: `);
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                throw new HaltDeployError(deploy, `Waiting on multisig signers.`);
            }
            break;
        }
        case "multisig_execute": {
            // `gnosis.api` only.
            const multisigDeploy = await metatxn.getJSONFile<TGnosisRequest>(
                canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
            )
            const safeApi = new SafeApiKit({chainId: BigInt(deploy._.chainId), txServiceUrl: overrideTxServiceUrlForChainId(deploy._.chainId)})
            const multisigTxn = await safeApi.getTransaction(multisigDeploy._.safeTxHash);

            const multisigTxnPersist = await metatxn.getJSONFile(canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
            multisigTxnPersist._ = multisigTxn;
            await multisigTxnPersist.save();
            
            if (!multisigTxn.isExecuted) {
                console.log(chalk.cyan(`SafeTxn(${multisigDeploy._.safeTxHash}): still waiting for execution.`))
                console.error(`\tShare the following URI: ${multisigBaseUrl(deploy._.chainId)}/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                console.error(`Resume deploy with: `)
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction awaiting execution`);
                throw new HaltDeployError(deploy, `Waiting on multisig transaction execution.`);
            } else if (!multisigTxn.isSuccessful) {
                console.log(chalk.red(`SafeTxn(${multisigDeploy._.safeTxHash}): failed onchain. Failing deploy.`))
                deploy._.phase = 'failed';
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                throw new HaltDeployError(deploy, `Multisig transaction failed.`);
            } else {
                console.log(chalk.green(`SafeTxn(${multisigDeploy._.safeTxHash}): executed (${multisigTxn.transactionHash})`))
                await advance(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction executed`);
            }
            break;
        }
        case "multisig_wait_confirm": {
            const multisigTxn = await metatxn.getJSONFile<SafeMultisigTransactionResponse>(
                canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
            )

            if (!multisigTxn || !multisigTxn._ || !multisigTxn._.transactionHash) {
                console.error(`Deploy missing multisig transaction data.`);
                throw new HaltDeployError(deploy, `Zeus script outputted no multisig transactions.`);
            }

            if (multisigTxn._.executionDate && multisigTxn._.transactionHash) {
                const _rpcUrl = options?.defaultArgs?.rpcUrl ?? await prompts.rpcUrl(deploy._.chainId);
                const client = createPublicClient({
                    chain: getChain(deploy._.chainId), 
                    transport: http(_rpcUrl),
                })

                const prompt = ora(`Waiting for transaction receipt: ${multisigTxn._.transactionHash}...`);
                const spinner = prompt.start();
                try {
                    const r = await client.waitForTransactionReceipt({hash: multisigTxn._.transactionHash as `0x${string}`});
                    if (r.status === 'success') {
                        spinner.stopAndPersist({prefixText: '✅'});
                        console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): successful onchain (${r.transactionHash})`))
                        deploy._.metadata[deploy._.segmentId] = {...(deploy._.metadata[deploy._.segmentId] ?? {}), confirmed: true};
                        await advance(deploy);
                        await deploy.save();
                        
                        if (deploy._.segments[deploy._.segmentId] && !isTerminalPhase(deploy._.phase) && !options?.nonInteractive) {
                            console.log(chalk.bold(`To continue running this upgrade, re-run with --resume. Deploy will resume from phase: ${deploy._.segments[deploy._.segmentId].filename}`))
                            console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                            await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction success`);
                            throw new HaltDeployError(deploy, `Waiting to begin next phase.`)
                        }
                        break;
                    } else {
                        spinner.stopAndPersist({prefixText: '❌'});
                        console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): reverted onchain (${r.transactionHash})`))
                        deploy._.phase = 'failed';
                        await deploy.save();
                        await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                        throw new HaltDeployError(deploy, `Multisig transaction failed.`);
                    } 
                } catch (e) {
                    spinner.stopAndPersist({prefixText: '❌'});
                    if (e instanceof HaltDeployError) {
                        // a prior error caused the deploy to halt.
                        throw e;
                    }
                    console.error(`Multisig Transaction (${multisigTxn._.transactionHash}) hasn't landed in a block yet.`)
                    console.error(`Re-run to check status:`)
                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                    console.error(e);
                    throw new HaltDeployError(deploy, `Transaction (${multisigTxn._.transactionHash}) might have not landed in a block yet.`)
                }
            }   
            break;
        }
        default:
            throw new HaltDeployError(deploy, `Unknown deploy phase: '${deploy._.phase}'`);
    }
}

const handler: PhaseTypeHandler = {
    execute: executeMultisigPhase,
    cancel: async (deploy: SavebleDocument<TDeploy>, metatxn: Transaction, _options: TStrategyOptions | undefined) => {
        switch (deploy._.phase) {
            case 'multisig_execute':
            case 'multisig_wait_signers': 
            case 'multisig_wait_confirm': {
                const meta = (deploy._.metadata[deploy._.segmentId] as MultisigMetadata)
                if (!meta || !meta.gnosisTransactionHash) {
                    return; // no information on what transaction was sent... just cancel and ignore it :/
                }

                console.error(`Your deploy queued a multisig transaction () which must be cancelled.`)
                console.error(`Gnosis cancellation involves submitting an empty txn with an identical nonce, to overwrite the txn onchain.`)

                const strategy = await promptForStrategyWithOptions(deploy, metatxn, `How would you like to submit this transaction?`, {defaultArgs: {etherscanApiKey: false}})
                await strategy.cancel(deploy);
                break;
            }
            case 'multisig_start': {
                const meta = (deploy._.metadata[deploy._.segmentId] as MultisigMetadata)
                if (!meta || !meta.confirmed && !meta.gnosisTransactionHash) {
                    return; // no harm, no foul -- nothing has been submitted yet (at least that we know of.)
                }
            }
        }
        
        return;
    }
}

export default handler;