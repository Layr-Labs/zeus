
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import EOABaseSigningStrategy from "../../signing/strategies/eoa/eoa";
import { HaltDeployError, TForgeRequest, TFoundryDeploy, TStrategyOptions } from "../../signing/strategy";
import { ForgeSolidityMetadata, TDeploy, TDeployedContractsManifest, TDeployStateMutations, TMutation, TTestOutput } from "../../metadata/schema";
import EOASigningStrategy from "../../signing/strategies/eoa/privateKey";
import ora from "ora";
import { runTest } from "../../signing/strategies/test";
import { canonicalPaths } from "../../metadata/paths";
import { advance, cleanContractName, sleepMs } from "../../commands/deploy/cmd/utils";
import chalk from "chalk";
import { wouldYouLikeToContinue } from "../../commands/prompts";
import { getRepoRoot } from "../../commands/configs";
import { computeFairHash } from "../../commands/deploy/utils";
import { injectableEnvForEnvironment } from "../../commands/run";
import { createPublicClient, http, TransactionReceiptNotFoundError } from "viem";
import { PhaseTypeHandler } from "./base";
import * as strategies from "../../commands/deploy/cmd/utils-strategies";
import { existsSync, readFileSync } from "fs";
import * as prompts from '../../commands/prompts';

export async function executeEOAPhase(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, options: TStrategyOptions | undefined): Promise<void> {
    let fallbackEoaStrategy: EOABaseSigningStrategy | undefined = undefined;

    if (options?.nonInteractive || options?.defaultArgs?.fork) {
        fallbackEoaStrategy = new EOASigningStrategy(deploy, metatxn, options);
    }

    let eoaStrategy: EOABaseSigningStrategy | undefined = undefined;

    const rpcUrl = await (async () => {
        if (options?.defaultArgs?.rpcUrl) {
            return options?.defaultArgs?.rpcUrl;
        }
        return await prompts.rpcUrl(deploy._.chainId);
    })();
        
    switch (deploy._.phase) {
        // eoa states
        case "eoa_validate": {
            const script = canonicalPaths.currentScriptLocation(deploy._);
            if (!existsSync(script)) {
                console.error(`existsSync(${script}) = false`);
                console.error(`Missing expected script: ${script}`);
                console.error(`Fix your local copy and continue with: `);
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`)
                throw new HaltDeployError(deploy, `Missing script. existsSync(${script}) = false`, false);
            }
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

            if (!options?.defaultArgs?.nonInteractive && !options?.defaultArgs?.fork) {
                console.log(`Zeus would like to simulate this EOA transaction before attempting it for real. Please choose the method you'll use to sign:`)
                const strategy = (await strategies.promptForStrategyWithOptions(deploy, metatxn, undefined, {nonInteractive: !!options?.nonInteractive, defaultArgs: {...(options?.defaultArgs ?? {}), rpcUrl}})) as unknown as EOABaseSigningStrategy;
                const sigRequest = await strategy.prepare(script, deploy._) as TForgeRequest;
                console.log(chalk.yellow(`Please reviewing the following: `))
                console.log(chalk.yellow(`=====================================================================================`))
                console.log(chalk.bold.underline(`Forge output: `))
                console.log(JSON.stringify(sigRequest.forge, null, 2));
                console.log(JSON.stringify(sigRequest.output, null, 2));
                console.log(chalk.bold.underline(`Simulation Deployed Contracts: `))
                if (sigRequest.deployedContracts && Object.keys(sigRequest.deployedContracts).length > 0) {
                    console.table(sigRequest.deployedContracts)
                } else {
                    console.log(chalk.bold(`<none>`));
                }
                console.log(chalk.bold.underline(`Simulation Updated Environment: `));
                if (sigRequest.stateUpdates && Object.keys(sigRequest.stateUpdates).length > 0) {
                    console.table(sigRequest.stateUpdates.map(mut => {return {name: mut.name, value: mut.value}}));
                } else {
                    console.log(chalk.bold(`<none>`))
                }
                console.log(chalk.yellow(`=====================================================================================`))
                if (!await wouldYouLikeToContinue()) {
                    return;
                }
            }

            await advance(deploy);
            await deploy.save();
            await metatxn.commit(`[deploy ${deploy._.name}] eoa test`);
            console.log(chalk.green(`+ recorded successful test run`));

            break;
        }
        case "eoa_start": {
            const script = canonicalPaths.currentScriptLocation(deploy._);
            if (existsSync(script)) {
                eoaStrategy = fallbackEoaStrategy ?? await strategies.promptForStrategyWithOptions(deploy, metatxn, undefined, {...options, nonInteractive: !!options?.nonInteractive, defaultArgs: {...(options?.defaultArgs ?? {}), rpcUrl}}) as EOABaseSigningStrategy;
                const sigRequest = await eoaStrategy.requestNew(script, deploy._) as TForgeRequest;
                if (sigRequest?.ready) {
                    deploy._.metadata[deploy._.segmentId] = {
                        type: "eoa",
                        signer: sigRequest.signer, // the signatory to the multisig transaction.
                        transactions: sigRequest.signedTransactions ?? [],
                        deployments: sigRequest.deployedContracts ?? [],
                        confirmed: false
                    }
                    await advance(deploy);
                    await deploy.save();

                    const foundryRun = await metatxn.getJSONFile(canonicalPaths.foundryRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}));
                    const foundryDeploy = await metatxn.getJSONFile<TFoundryDeploy>(canonicalPaths.foundryDeploy({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}));
                    
                    foundryRun._ = (sigRequest.forge?.runLatest ?? {}) as TFoundryDeploy;
                    foundryDeploy._ = (sigRequest.forge?.deployLatest ?? {}) as TFoundryDeploy;

                    await foundryRun.save();
                    await foundryDeploy.save();

                    // look up any contracts compiled and their associated bytecode.
                    const withDeployedBytecodeHashes = await Promise.all(sigRequest.deployedContracts?.map(async (contract) => {
                        const contractInfo = JSON.parse(readFileSync(canonicalPaths.contractInformation(getRepoRoot(), cleanContractName(contract.contract)), 'utf-8')) as ForgeSolidityMetadata;
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
                                signer: sigRequest.signer,
                            },
                        };
                    }) || []);

                    const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
                    if (!deployedContracts._.contracts) {
                        deployedContracts._.contracts = [];
                    }

                    deployedContracts._.contracts.push(...withDeployedBytecodeHashes);
                    await deployedContracts.save();

                    if (withDeployedBytecodeHashes) {
                        console.log(`Deployed Contracts:`);
                        console.table(withDeployedBytecodeHashes.map(v => {return {...v, lastUpdatedIn: undefined}}));
                        console.log();
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

                    await metatxn.commit(`[deploy ${deploy._.name}] eoa transaction`);
                    console.log(chalk.green(`+ uploaded metadata`));
                } else {
                    console.error(`Deploy failed with ready=false. Please try again.`);
                    return;
                }
            } else {
                console.error(`Missing expected script: ${script}`);
                console.error(`Fix your local copy and continue with: `);
                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`)
                throw new HaltDeployError(deploy, `Deploy failed - missing expected script. Please try again.`, false);
            }
            break;
        }
        case "eoa_wait_confirm": {
            const foundryDeploy = await metatxn.getJSONFile<TFoundryDeploy>(
                canonicalPaths.foundryDeploy({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})    
            );

            if (!foundryDeploy) {
                throw new HaltDeployError(deploy, 'foundry.deploy.json was corrupted.', false);
            }

            const localRpcUrl = rpcUrl;
            const client = createPublicClient({
                transport: http(localRpcUrl),
            })

            if (foundryDeploy._.transactions?.length) {
                const prompt = ora(`Verifying ${foundryDeploy._.transactions?.length ?? 0} transactions...`);
                const spinner = prompt.start();
                try {
                    const maxRetries = 5;
                    let attempt = 0;
                    let done = false;
                    while (!done && attempt < maxRetries) {
                        attempt++;
                        try {
                            let anyNotDone = false;
                            for (const txn of (foundryDeploy._.transactions ?? [])) {
                                if (txn?.hash) {
                                    const receipt = await client.getTransactionReceipt({hash: txn.hash});
                                    console.log(`Got receipt: ${receipt?.transactionHash}`);
                                    if (receipt.status === "success") {
                                        console.log(`${chalk.green('✔')} Transaction(${txn.hash})`);
                                    } else {
                                        console.error(`Transaction(${txn}) did not succeed: ${receipt.status}`)
                                        anyNotDone = true;
                                        continue;
                                        // TODO: what is the step forward here for the user? (push deploy back a phase)
                                    }
                                }
                            } 
                            if (!anyNotDone) {
                                done = true;
                            } else {
                                await sleepMs(5000);
                            }
                        } catch (e) {
                            if (e instanceof TransactionReceiptNotFoundError) {
                                console.warn(`Transaction not in a block yet.`);
                                console.warn(e);
                            } else {
                                console.warn(e);
                            }
                            
                            await sleepMs(5000);
                            continue;
                        }
                        done = true;
                    }

                    if (attempt === maxRetries - 1) {
                        throw new Error(`Failed max number of times.`);
                    }
                } finally {
                    spinner.stopAndPersist();
                }
            }

            deploy._.metadata[deploy._.segmentId].confirmed = true;
            await advance(deploy);
            await deploy.save();
            await metatxn.commit(`[deploy ${deploy._.name}] eoa transaction confirmed`);
            break;
        }
        default:
            console.error(`Deploy is in unknown phase: ${deploy._.phase}. Make sure your zeus is up-to-date.`);
            throw new HaltDeployError(deploy, `Unknown deploy phase.`, false);
    }

    return;
}

const handler: PhaseTypeHandler = {
    execute: executeEOAPhase,
    cancel: undefined /* no special logic is needed to cancel during an EOA phase. */
}

export default handler;
