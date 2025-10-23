import { join } from "path";
import { existsSync, readFileSync } from "fs";
import ora from "ora";
import chalk from "chalk";
import { createPublicClient, http } from "viem";
import { SafeMultisigTransactionResponse} from '@safe-global/types-kit';
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { HaltDeployError, PauseDeployError, TGnosisRequest, TStrategyOptions } from "../../signing/strategy";
import { GnosisSigningStrategy } from "../../signing/strategies/gnosis/gnosis";
import { GnosisOnchainEOAStrategy } from "../../signing/strategies/gnosis/onchain/onchainEoa";
import { MultisigMetadata, TDeploy, TDeployStateMutations, TMutation, TTestOutput, TDeployedContractsManifest, ForgeSolidityMetadata } from "../../metadata/schema";
import { advance, advanceSegment, getChain, isTerminalPhase, cleanContractName } from "../../commands/deploy/cmd/utils";
import { injectableEnvForEnvironment } from "../../commands/run";
import { canonicalPaths } from "../../metadata/paths";
import { multisigBaseUrl, overrideTxServiceUrlForChainId } from "../../signing/strategies/gnosis/api/utils";
import { PhaseTypeHandler } from "./base";
import { promptForStrategy, promptForStrategyWithOptions } from "../../commands/deploy/cmd/utils-strategies";
import { runTest } from "../../signing/strategies/test";
import * as prompts from '../../commands/prompts';
import { configs } from "../../commands/configs";
import { computeFairHash } from "../../commands/deploy/utils";

async function loadSafeApiKit(): Promise<any> {
    try {
        if (process.env.JEST_WORKER_ID) {
            const mockMod = await import('../../../__mocks__/@safe-global/api-kit');
            return mockMod.default;
        }
    } catch {
        // ignore and fall through to real module
    }
    const realMod = await import('@safe-global/api-kit');
    return realMod.default;
}

export async function executeMultisigPhase(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, options: TStrategyOptions | undefined): Promise<void> {
    let multisigStrategy: GnosisSigningStrategy | undefined = undefined;

    if (options?.nonInteractive || options?.defaultArgs?.fork) {
        multisigStrategy = new GnosisOnchainEOAStrategy(deploy, metatxn, options);
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
                    const res = await runTest({env: deploy._.env, upgradePath: script, rpcUrl, txn: metatxn, context: {deploy: deploy._.name}, verbose: false, json: true})
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
                if (sigRequest.empty) {
                    deploy._.metadata[deploy._.segmentId] = {
                        type: "multisig",
                        signer: sigRequest.senderAddress,
                        signerType: multisigStrategy.id,
                        gnosisTransactionHash: sigRequest.safeTxHash as `0x${string}`,
                        gnosisCalldata: undefined, // ommitting this so that a third party can't execute immediately.
                        multisig: sigRequest.safeAddress,
                        confirmed: true,
                        cancellationTransactionHash: undefined
                    }
                    console.log(chalk.bold.underline(`This script did not output a transaction. Will be skipped.`));
                } else {
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

                // Handle deployed contracts from ZeusDeploy events
                if (sigRequest.deployedContracts && sigRequest.deployedContracts.length > 0) {
                    const zeusConfigDirName = await configs.zeus.dirname();
                    const withDeployedBytecodeHashes = await Promise.all(sigRequest.deployedContracts.map(async (contract) => {
                        const contractInfo = JSON.parse(readFileSync(canonicalPaths.contractInformation(zeusConfigDirName, cleanContractName(contract.contract)), 'utf-8')) as ForgeSolidityMetadata;
                        // save the contract abi.
                        const segmentAbi = await metatxn.getJSONFile<ForgeSolidityMetadata>(canonicalPaths.segmentContractAbi({...deploy._, contractName: cleanContractName(contract.contract)}))
                        segmentAbi._ = contractInfo;
                        await segmentAbi.save();
                        return {
                            ...contract,
                            deployedBytecodeHash: computeFairHash(contractInfo.deployedBytecode.object, contractInfo),
                            lastUpdatedIn: {
                                name: deploy._.name,
                                phase: deploy._.phase,
                                segment: deploy._.segmentId,
                                signer: sigRequest.senderAddress || '0x0',
                            },
                        };
                    }));

                    const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
                    if (!deployedContracts._.contracts) {
                        deployedContracts._.contracts = [];
                    }

                    deployedContracts._.contracts.push(...withDeployedBytecodeHashes);
                    await deployedContracts.save();

                    console.log(`Deployed Contracts (via multisig):`);
                    console.table(withDeployedBytecodeHashes.map(v => {return {...v, lastUpdatedIn: undefined}}));
                    console.log();
                }

                const multisigRun = await metatxn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                multisigRun._ = sigRequest;
                await multisigRun.save();

                if (sigRequest.empty) {
                    console.log(`No transaction, skipping forward.`);
                    await advance(deploy);
                    await deploy.save();
                    await metatxn.commit(`[deploy ${deploy._.name}] multisig step did not output a transaction`);

                } else if (sigRequest.immediateExecution && sigRequest.immediateExecution.transaction) {
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
            const safeTxHash = multisigDeploy._.safeTxHash;
            if (!safeTxHash) {
                console.log(`No multisig tx hash found, skipping forward.`)
                await advanceSegment(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig step did not output a transaction`);
                return;
            }

            const defaultUrl = overrideTxServiceUrlForChainId(deploy._.chainId);
            const safeTxServiceUrl = await prompts.safeTxServiceUrl(deploy._.chainId, defaultUrl);
            const safeApiKey = await prompts.safeApiKey(deploy._.chainId);
            const SafeApiKitCtor = await loadSafeApiKit();
            const safeApi = new SafeApiKitCtor({chainId: BigInt(deploy._.chainId), txServiceUrl: safeTxServiceUrl, apiKey: safeApiKey})
            const multisigTxn = await safeApi.getTransaction(safeTxHash);
            
            if (multisigTxn.confirmations?.length === multisigTxn.confirmationsRequired) {
                console.log(chalk.green(`SafeTxn(${safeTxHash}): ${multisigTxn.confirmations?.length}/${multisigTxn.confirmationsRequired} confirmations received!`))
                await advance(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction signers found`);
            } else {
                console.error(`Waiting on ${multisigTxn.confirmationsRequired - (multisigTxn.confirmations?.length ?? 0)} more confirmations. `)
                console.error(`\tShare the following URI: ${multisigBaseUrl(deploy._.chainId)}/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                console.error(`Run the following to continue: `);
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                throw new PauseDeployError(deploy, `Waiting on multisig signers.`);
            }
            break;
        }
        case "multisig_execute": {
            // `gnosis.api` only.
            const multisigDeploy = await metatxn.getJSONFile<TGnosisRequest>(
                canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
            )
            const safeTxHash = multisigDeploy._.safeTxHash;
            if (!safeTxHash) {
                console.log(`No multisig tx hash found, skipping forward.`)
                await advanceSegment(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig step did not output a transaction`);
                return;
            }
            const defaultUrl = overrideTxServiceUrlForChainId(deploy._.chainId);
            const safeTxServiceUrl = await prompts.safeTxServiceUrl(deploy._.chainId, defaultUrl);
            const safeApiKey = await prompts.safeApiKey(deploy._.chainId);
            const SafeApiKitCtor = await loadSafeApiKit();
            const safeApi = new SafeApiKitCtor({chainId: BigInt(deploy._.chainId), txServiceUrl: safeTxServiceUrl, apiKey: safeApiKey})
            const multisigTxn = await safeApi.getTransaction(safeTxHash);

            const multisigTxnPersist = await metatxn.getJSONFile(canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
            multisigTxnPersist._ = multisigTxn;
            await multisigTxnPersist.save();
            
            if (!multisigTxn.isExecuted) {
                console.log(chalk.cyan(`SafeTxn(${safeTxHash}): still waiting for execution.`))
                console.error(`\tShare the following URI: ${multisigBaseUrl(deploy._.chainId)}/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                console.error(`Resume deploy with: `)
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction awaiting execution`);
                throw new HaltDeployError(deploy, `Waiting on multisig transaction execution.`);
            } else if (!multisigTxn.isSuccessful) {
                console.log(chalk.red(`SafeTxn(${safeTxHash}): failed onchain. Failing deploy.`))
                deploy._.phase = 'failed';
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                throw new HaltDeployError(deploy, `Multisig transaction failed.`);
            } else {
                console.log(chalk.green(`SafeTxn(${safeTxHash}): executed (${multisigTxn.transactionHash})`))
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
                console.log(`No multisig tx hash found, skipping forward.`)
                await advanceSegment(deploy);
                await deploy.save();
                await metatxn.commit(`[deploy ${deploy._.name}] multisig step did not output a transaction`);
                return;
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
                            throw new PauseDeployError(deploy, `Waiting to begin next phase.`)
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
            } else {
                throw new PauseDeployError(deploy, `Transaction is waiting for execution.`);
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

                console.error(`Your deploy queued a multisig transaction which must be cancelled.`)
                console.error(`Gnosis cancellation involves submitting an empty txn with an identical nonce, to overwrite the txn onchain.`)

                const strategy = await promptForStrategyWithOptions(deploy, metatxn, `How would you like to submit this transaction?`, {nonInteractive: false, defaultArgs: {etherscanApiKey: false}})
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