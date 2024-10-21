import { command } from "cmd-ts";
import * as allArgs from '../../args';
import { TState, requires, loggedIn } from "../../inject";
import { configs, getRepoRoot } from '../../configs';
import { getActiveDeploy, updateLatestDeploy, advance, promptForStrategy, isTerminalPhase } from "./utils";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { TForgeRequest, TGnosisRequest } from "../../../signing/strategy";
import chalk from "chalk";
import { canonicalPaths } from "../../../metadata/paths";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import ora from 'ora';
import fs from 'fs';
import { Segment, TDeploy, TDeployPhase, TEnvironmentManifest, TUpgrade } from "../../../metadata/schema";
import SafeApiKit from "@safe-global/api-kit";
import { SafeMultisigTransactionResponse} from '@safe-global/types-kit';
import { SEPOLIA_CHAIN_ID } from "../../../signing/strategies/utils";
import { GnosisEOAStrategy } from "../../../signing/strategies/gnosisEoa";
import semver from 'semver';
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";

process.on("unhandledRejection", (error) => {
    console.error(error); // This prints error with stack included (as for normal errors)
    throw error; // Following best practices re-throw error and let the process exit with error code
});


// check the transactions created by the previous step.
type TFoundryDeploy  = {
    transactions: {
        hash: `0x${string}`
    }[]
}

const blankDeploy = (args: {env: string, chainId: number, upgrade: string, upgradePath: string, name: string, segments: Segment[]}) => {
    const start = new Date();
    const deploy: TDeploy = {
        name: args.name,
        env: args.env,
        segmentId: 0,
        segments: args.segments,
        metadata: [],
        upgrade: args.upgrade,
        upgradePath: args.upgradePath,
        phase: "" as TDeployPhase,
        chainId: args.chainId,
        startTime: start.toString(),
        startTimestamp: start.getTime() / 1000,
    };
    return deploy;
}

function formatNow() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}-${minutes}`;
}

async function handler(user: TState, args: {env: string, resume: boolean, rpcUrl: string | undefined, json: boolean, upgrade: string | undefined}) {
    const metaTxn = await user.metadataStore!.begin();

    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        return;
    }

    const deploy = await getActiveDeploy(metaTxn, args.env);
    if (deploy) {
        if (args.upgrade || !args.resume) {
            console.error(`Existing deploy in progress. Please rerun with --resume (and not --upgrade, as the current upgrade is ${deploy._.upgrade}).`)
            console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`)
            return;
        }

        console.log(`Resuming existing deploy... (began at ${deploy._.startTime})`);
        return await executeOrContinueDeploy(deploy, user, metaTxn, args.rpcUrl);
    } else if (args.resume) {
        console.error(`Nothing to resume.`);
        return;
    }

    if (!args.upgrade) {
        console.error(`Must specify --upgrade <upgradeName>`);
        return;
    }

    const upgradePath = normalize(join(getRepoRoot(), repoConfig.migrationDirectory, args.upgrade))
    if (!existsSync(upgradePath) || !lstatSync(upgradePath).isDirectory() ) {
        console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory. (searching '${upgradePath}')`)
        return;
    }
    const blankDeployName = `${formatNow()}-${args.upgrade}`;

    let _id = 0;
    const segments = fs.readdirSync(upgradePath).filter(p => p.endsWith('.s.sol') && (p.includes('eoa') || p.includes('multisig'))).sort((a, b) => a.localeCompare(b)).map<Segment>(p => {
        if (p.includes('eoa')) {
            return {
                id: _id++,
                filename: p,
                type: 'eoa'
            }
        } else {
            return {
                id: _id++,
                filename: p,
                type: 'multisig'
            }
        }
    });
    const newDeploy = blankDeploy({name: blankDeployName, chainId: SEPOLIA_CHAIN_ID, env: args.env, upgrade: args.upgrade, upgradePath, segments});
    const deployJsonPath = canonicalPaths.deployStatus({env: args.env, name: blankDeployName});

    const deployJson = await metaTxn.getJSONFile<TDeploy>(deployJsonPath);
    deployJson._ = newDeploy;
    await deployJson.save();

    const upgradeManifest = await metaTxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(args.upgrade));
    const envManifest = await metaTxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));

    if (!semver.satisfies(envManifest!._.deployedVersion ?? '0.0.0', upgradeManifest!._.from)) {
        console.error(`Unsupported upgrade. ${deployJson!._.name} requires an environment meet the following version criteria: (${upgradeManifest!._.from})`);
        console.error(`Environment ${deployJson!._.env} is currently deployed at '${envManifest!._.deployedVersion}'`);
        return;
    }

    console.log(chalk.green(`+ creating deploy: ${deployJsonPath}`));
    console.log(chalk.green(`+ started deploy (${envManifest?._.deployedVersion}) => (${upgradeManifest!._.to}) (requires: ${upgradeManifest!._.from})`));

    await executeOrContinueDeploy(deployJson, user, metaTxn, args.rpcUrl);
}

const executeOrContinueDeploy = async (deploy: SavebleDocument<TDeploy>, user: TState, txn: Transaction, rpcUrl: string | undefined) => {
    while (true) {
        console.log(chalk.green(`[${deploy._.segments[deploy._.segmentId]?.filename ?? '<none>'}] ${deploy._.phase}`))
        
        switch (deploy._.phase) {
            // global states
            case "":
                await advance(deploy);
                await deploy.save()
                await updateLatestDeploy(txn, deploy._.env, deploy._.name);
                break;
            case "complete": {
                console.log(`Deploy completed. ✅`);
                await updateLatestDeploy(txn, deploy._.env, undefined, true);

                // update deployed version in the environment.
                const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deploy._.env));
                if (!envManifest) {
                    console.error(`Corrupted env manifest.`);
                    return;
                }

                const upgrade = await txn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(deploy._.upgrade));
                if (!upgrade) {
                    console.error(`No upgrade manifest for '${deploy._.upgrade}' found.`);
                    return;
                }

                envManifest._.deployedVersion = upgrade!._.to;
                envManifest._.latestDeployedCommit = upgrade!._.commit;

                // TODO:(milestone1) how/where do contract addresses get updated...
                envManifest.save();
                deploy.save();
                await txn.commit(`Deploy ${deploy._.name} completed!`);
                return;
            }
            case "failed": {
                console.error(`The deploy failed. ❌`);
                await updateLatestDeploy(txn, deploy._.env, undefined, true);
                await txn.commit(`Deploy ${deploy._.name} failed.`);
                return;
            }
            case "cancelled":
                console.log(`Deploy was cancelled. ❌`);
                await updateLatestDeploy(txn, deploy._.env, undefined, true);
                await deploy.save();
                await txn.commit(`Deploy ${deploy._.name} cancelled.`);
                return;
            // eoa states
            case "eoa_start": {
                const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);
                if (existsSync(script)) {
                    // TODO: check whether this deploy already has forge documents uploaded from a previous run.
                    // (i.e that it bailed before advancing.)
                    const strategy =  await promptForStrategy(deploy, txn);
                    const sigRequest = await strategy.requestNew(script, deploy._) as TForgeRequest;
                    if (sigRequest?.ready) {
                        deploy._.metadata[deploy._.segmentId] = {
                            type: "eoa",
                            signer: sigRequest.signer, // the signatory to the multisig transaction.
                            transactions: sigRequest.signedTransactions ?? [],
                            deployments: sigRequest.deployedContracts!,
                            confirmed: false
                        }
                        await advance(deploy);
                        await deploy.save();

                        const foundryRun = await txn.getJSONFile(canonicalPaths.foundryRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}));
                        const foundryDeploy = await txn.getJSONFile<TFoundryDeploy>(canonicalPaths.foundryDeploy({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}));
                        
                        foundryRun._ = sigRequest.forge?.runLatest;
                        foundryDeploy._ = sigRequest.forge?.deployLatest as TFoundryDeploy;

                        await foundryRun.save();
                        await foundryDeploy.save();
                        await txn.commit(`[deploy ${deploy._.name}] eoa transaction`);

                        console.log(chalk.green(`+ uploaded metadata`));
                    } else {
                        console.error(`Deploy failed with ready=false. Please try again.`);
                        return;
                    }
                } else {
                    console.error(`Missing expected script: ${script}`);
                    console.error(`Fix your local copy and continue with: `);
                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`)
                    return;
                }
                break;
            }
            case "eoa_wait_confirm": {
                const foundryDeploy = await txn.getJSONFile<TFoundryDeploy>(
                    canonicalPaths.foundryDeploy({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})    
                );

                if (!foundryDeploy) {
                    throw new Error('foundry.deploy.json was corrupted.');
                }

                // TODO:multicain
                const client = createPublicClient({
                    chain: sepolia, 
                    transport: http(rpcUrl),
                })
                const prompt = ora(`Verifying ${foundryDeploy._.transactions.length} transactions...`);
                const spinner = prompt.start();
                for (const txn of foundryDeploy._.transactions) {
                    if (txn?.hash) {
                        const receipt = await client.getTransactionReceipt({hash: txn.hash});
                        if (receipt.status !== "success") {
                            console.error(`Transaction(${txn}) did not succeed: ${receipt.status}`)
                            return;
                            // TODO: what is the step forward here for the user?
                        }
                    }
                }

                spinner.stopAndPersist();
                deploy._.metadata[deploy._.segmentId].confirmed = true;
                await advance(deploy);
                await deploy.save();
                await txn.commit(`[deploy ${deploy._.name}] eoa transaction confirmed`);
                if (deploy._.segments[deploy._.segmentId] && !isTerminalPhase(deploy._.phase)) {
                    console.log(chalk.bold(`To continue running this upgrade, re-run with --resume. Deploy will resume from phase: ${deploy._.segments[deploy._.segmentId].filename}`))
                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                    await txn.commit(`[${deploy._.segments[deploy._.segmentId]?.filename ?? '<none>'}] ${deploy._.phase} - complete`);
                    return;
                }
                break;
            }
            // multisig states.
            case "multisig_start": {             
                const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);   
                if (existsSync(script)) {
                    const strategy =  await promptForStrategy(deploy, txn);
                    const sigRequest = await strategy.requestNew(script, deploy._) as TGnosisRequest;
                    deploy._.metadata[deploy._.segmentId] = {
                        type: "multisig",
                        signer: sigRequest.senderAddress,
                        signerType: strategy instanceof GnosisEOAStrategy ? 'eoa' : 'ledger', // TODO: fragile
                        gnosisTransactionHash: sigRequest.safeTxHash as `0x${string}`,
                        gnosisCalldata: undefined, // ommitting this so that a third party can't execute immediately.
                        multisig: sigRequest.safeAddress,
                        confirmed: false,
                        cancellationTransactionHash: undefined
                    };
                    const multisigRun = await txn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                    multisigRun._ = sigRequest;
                    await multisigRun.save();
                    await advance(deploy);
                    await deploy.save();
                    await txn.commit(`[deploy ${deploy._.name}] multisig transaction started`);
                } else {
                    console.error(`Missing expected script: ${script}. Please check your local copy and try again.`)
                    return;
                }
                break;
            }
            case "multisig_wait_signers": {
                const multisigDeploy = await txn.getJSONFile<TGnosisRequest>(
                    canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
                )
                const safeApi = new SafeApiKit({chainId: BigInt(SEPOLIA_CHAIN_ID)})
                const multisigTxn = await safeApi.getTransaction(multisigDeploy!._.safeTxHash);

                if (multisigTxn.confirmations?.length === multisigTxn.confirmationsRequired) {
                    console.log(chalk.green(`SafeTxn(${multisigDeploy!._.safeTxHash}): ${multisigTxn.confirmations?.length}/${multisigTxn.confirmationsRequired} confirmations received!`))
                    await advance(deploy);
                    await deploy.save();
                    await txn.commit(`[deploy ${deploy._.name}] multisig transaction signers found`);
                } else {
                    console.error(`Waiting on ${multisigTxn.confirmationsRequired - (multisigTxn.confirmations?.length ?? 0)} more confirmations. `)
                    console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy!._.safeAddress}`)
                    console.error(`Run the following to continue: `);
                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                    return;
                }
                break;
            }
            case "multisig_execute": {
                const multisigDeploy = await txn.getJSONFile<TGnosisRequest>(
                    canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
                )
                const safeApi = new SafeApiKit({chainId: BigInt(SEPOLIA_CHAIN_ID)})
                const multisigTxn = await safeApi.getTransaction(multisigDeploy!._.safeTxHash);

                const multisigTxnPersist = await txn.getJSONFile(canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                multisigTxnPersist._ = txn;
                await multisigTxnPersist.save();
                
                if (!multisigTxn.isExecuted) {
                    console.log(chalk.cyan(`SafeTxn(${multisigDeploy!._.safeTxHash}): still waiting for execution.`))
                    console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy!._.safeAddress}`)
                    console.error(`Resume deploy with: `)
                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                    await txn.commit(`[deploy ${deploy._.name}] multisig transaction awaiting execution`);
                    return;
                } else if (!multisigTxn.isSuccessful) {
                    console.log(chalk.red(`SafeTxn(${multisigDeploy!._.safeTxHash}): failed onchain. Failing deploy.`))
                    deploy._.phase = 'failed';
                    await deploy.save();
                    await txn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                    continue;
                } else {
                    console.log(chalk.green(`SafeTxn(${multisigDeploy!._.safeTxHash}): executed (${multisigTxn.transactionHash})`))
                    await advance(deploy);
                    await txn.commit(`[deploy ${deploy._.name}] multisig transaction executed`);
                    await deploy.save();
                }
                break;
            }
            case "multisig_wait_confirm": {
                const multisigTxn = await txn.getJSONFile<SafeMultisigTransactionResponse>(
                    canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
                )

                if (!multisigTxn || !multisigTxn._) {
                    console.error(`Deploy missing multisig transaction data.`);
                    return;
                }

                if (multisigTxn._.executionDate && multisigTxn._.transactionHash) {
                    // check that the 
                    const client = createPublicClient({
                        chain: sepolia, 
                        transport: http(rpcUrl),
                    })
                    try {
                        const receipt = await client.getTransactionReceipt({hash: multisigTxn._.transactionHash as `0x${string}`});
                        if (receipt.status === 'success') {
                            console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): successful onchain (${receipt.transactionHash})`))
                            if (deploy._.metadata[deploy._.segmentId]) {
                                deploy._.metadata[deploy._.segmentId].confirmed = true;
                            }
                            await advance(deploy);
                            await deploy.save();
                            
                            if (deploy._.segments[deploy._.segmentId] && !isTerminalPhase(deploy._.phase)) {
                                console.log(chalk.bold(`To continue running this upgrade, re-run with --resume. Deploy will resume from phase: ${deploy._.segments[deploy._.segmentId].filename}`))
                                console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                                await txn.commit(`[deploy ${deploy._.name}] multisig transaction success`);
                                return;
                            }
                            break;
                        } else {
                            console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): reverted onchain (${receipt.transactionHash})`))
                            deploy._.phase = 'failed';
                            await deploy.save();
                            await txn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                            break;
                        } 
                    } catch (e) {
                        console.error(`Multisig Transaction (${multisigTxn._.transactionHash}) hasn't landed in a block yet.`)
                        console.error(`Re-run to check status:`)
                        console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                        console.error(e);
                        return;
                    }
                }   
                break;
            }
            default:
                console.error(`Deploy is in unknown phase: ${deploy._.phase}. Make sure your zeus is up-to-date.`);
                return;
        }
    }
}

export default command({
    name: 'run',
    description: 'Deploy an upgrade onto an environment. `zeus deploy <environment> <upgrade>`',
    version: '1.0.0',
    args: {
        env: allArgs.env,
        upgrade: allArgs.upgrade,
        resume: allArgs.resume,
        json: allArgs.json,
        rpcUrl: allArgs.rpcUrl,
    },
    handler: requires(handler, loggedIn),
})
