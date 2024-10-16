import { command } from "cmd-ts";
import * as allArgs from '../../args';
import { TState, requires, loggedIn } from "../../inject";
import { configs, getRepoRoot } from '../../configs';
import { getActiveDeploy, updateLatestDeploy, saveDeploy, advance, promptForStrategy } from "./utils";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { TForgeRequest, TGnosisRequest } from "../../../signing/strategy";
import chalk from "chalk";
import { canonicalPaths } from "../../../metadata/paths";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import ora from 'ora';
import fs from 'fs';
import { Segment, TDeploy, TDeployPhase } from "../../../metadata/schema";
import SafeApiKit from "@safe-global/api-kit";
import { SafeMultisigTransactionResponse} from '@safe-global/types-kit';
import { SEPOLIA_CHAIN_ID } from "../../../signing/strategies/utils";
import { GnosisEOAStrategy } from "../../../signing/strategies/gnosisEoa";

process.on("unhandledRejection", (error) => {
    console.error(error); // This prints error with stack included (as for normal errors)
    throw error; // Following best practices re-throw error and let the process exit with error code
  });

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
    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        return;
    }

    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        if (args.upgrade || !args.resume) {
            console.error(`Existing deploy in progress. Please rerun with --resume (and not --upgrade, as the current upgrade is ${deploy.upgrade}).`)
            console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`)
            return;
        }

        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        return await executeOrContinueDeploy(deploy, user, args.rpcUrl);
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
    
    const deployJsonPath = join(canonicalPaths.deployDirectory('', args.env, blankDeployName), "deploy.json");
    // create the new deploy.
    await user!.metadataStore?.updateFile(
        deployJsonPath, 
        '{}',
    )
    console.log(chalk.green(`+ creating deploy: ${deployJsonPath}`));
    console.log(chalk.green('+ started deploy'));

    await executeOrContinueDeploy(newDeploy, user, args.rpcUrl);
}

const executeOrContinueDeploy = async (deploy: TDeploy, user: TState, rpcUrl: string | undefined) => {

    while (true) {
        console.log(chalk.green(`[${deploy.segments[deploy.segmentId]?.filename ?? '<none>'}] ${deploy.phase}`))
        
        switch (deploy.phase) {
            // global states
            case "":
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                await updateLatestDeploy(user.metadataStore!, deploy.env, deploy.name);
                break;
            case "complete":
                console.log(`Deploy completed. ✅`);
                await updateLatestDeploy(user.metadataStore!, deploy.env, undefined, true);
                await saveDeploy(user.metadataStore!, deploy);
                return;
            case "failed": {
                console.error(`The deploy failed. ❌`);
                await updateLatestDeploy(user.metadataStore!, deploy.env, undefined, true);
                return;
            }
            case "cancelled":
                console.log(`Deploy was cancelled. ❌`);
                await updateLatestDeploy(user.metadataStore!, deploy.env, undefined, true);
                await saveDeploy(user.metadataStore!, deploy);
                return;
            // eoa states
            case "eoa_start": {
                const script = join(deploy.upgradePath, deploy.segments[deploy.segmentId].filename);
                if (existsSync(script)) {
                    // TODO: check whether this deploy already has forge documents uploaded from a previous run.
                    // (i.e that it bailed before advancing.)
                    const strategy =  await promptForStrategy(deploy, user.metadataStore!);
                    const sigRequest = await strategy.requestNew(script, deploy) as TForgeRequest;
                    if (sigRequest?.ready) {
                        deploy.metadata[deploy.segmentId] = {
                            type: "eoa",
                            signer: sigRequest.signer, // the signatory to the multisig transaction.
                            transactions: sigRequest.signedTransactions ?? [],
                            deployments: sigRequest.deployedContracts!,
                            confirmed: false
                        }
                        advance(deploy);
                        await saveDeploy(user.metadataStore!, deploy);
                        await user.metadataStore!.updateJSON(
                            join(
                                canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                                `${deploy.segmentId}`,
                                "foundry.run.json"
                            ),
                            sigRequest.forge?.runLatest
                        )
                        await user.metadataStore!.updateJSON(
                            join(
                                canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                                `${deploy.segmentId}`,
                                "foundry.deploy.json"
                            ),
                            sigRequest.forge?.deployLatest
                        )
                        console.log(chalk.green(`+ uploaded metadata`));
                    } else {
                        console.error(`Deploy failed with ready=false. Please try again.`);
                        return;
                    }
                } else {
                    console.error(`Missing expected script: ${script}`);
                    console.error(`Fix your local copy and continue with: `);
                    console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`)
                    return;
                }
                break;
            }
            case "eoa_wait_confirm": {
                // check the transactions created by the previous step.
                type TFoundryDeploy  = {
                    transactions: {
                        hash: `0x${string}`
                    }[]
                }

                const foundryDeploy = await user.metadataStore?.getJSONFile<TFoundryDeploy>(
                    join(
                        canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                        `${deploy.segmentId}`,
                        "foundry.deploy.json"
                    ),
                );
                if (!foundryDeploy) {
                    throw new Error('foundry.deploy.json was corrupted.');
                }

                // TODO:multicain
                const client = createPublicClient({
                    chain: sepolia, 
                    transport: http(rpcUrl),
                })
                const prompt = ora(`Verifying ${foundryDeploy.transactions.length} transactions...`);
                const spinner = prompt.start();
                for (const txn of foundryDeploy.transactions) {
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
                deploy.metadata[deploy.segmentId].confirmed = true;
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                if (deploy.segments[deploy.segmentId]) {
                    console.log(chalk.bold(`To continue running this transaction, re-run with --resume. Deploy will resume from phase: ${deploy.segments[deploy.segmentId].filename}`))
                    console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`);
                    return;
                }
                break;
            }
            // multisig states.
            case "multisig_start": {             
                const script = join(deploy.upgradePath, deploy.segments[deploy.segmentId].filename);   
                if (existsSync(script)) {
                    const strategy =  await promptForStrategy(deploy, user.metadataStore!);
                    const sigRequest = await strategy.requestNew(script, deploy) as TGnosisRequest;
                    deploy.metadata[deploy.segmentId] = {
                        type: "multisig",
                        signer: sigRequest.senderAddress,
                        signerType: strategy instanceof GnosisEOAStrategy ? 'eoa' : 'ledger', // TODO: fragile
                        gnosisTransactionHash: sigRequest.safeTxHash as `0x${string}`,
                        gnosisCalldata: undefined, // ommitting this so that a third party can't execute immediately.
                        multisig: sigRequest.safeAddress,
                        confirmed: false,
                        cancellationTransactionHash: undefined
                    };
                    await user.metadataStore!.updateJSON(
                        join(
                            canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                            `${deploy.segmentId}`,
                            "multisig.run.json"
                        ),
                        sigRequest,
                    )
                    advance(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                } else {
                    console.error(`Missing expected script: ${script}. Please check your local copy and try again.`)
                    return;
                }
                break;
            }
            case "multisig_wait_signers": {
                const multisigDeploy = await user.metadataStore!.getJSONFile<TGnosisRequest>(
                    join(
                        canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                        `${deploy.segmentId}`,
                        "multisig.run.json"
                    )
                )
                const safeApi = new SafeApiKit({chainId: BigInt(SEPOLIA_CHAIN_ID)})
                const txn = await safeApi.getTransaction(multisigDeploy!.safeTxHash);

                if (txn.confirmations?.length === txn.confirmationsRequired) {
                    console.log(chalk.green(`SafeTxn(${multisigDeploy!.safeTxHash}): ${txn.confirmations?.length}/${txn.confirmationsRequired} confirmations received!`))
                    advance(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                } else {
                    console.error(`Waiting on ${txn.confirmationsRequired - (txn.confirmations?.length ?? 0)} more confirmations. `)
                    console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy!.safeAddress}`)
                    console.error(`Run the following to continue: `);
                    console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`);
                    return;
                }
                break;
            }
            case "multisig_execute": {
                const multisigDeploy = await user.metadataStore!.getJSONFile<TGnosisRequest>(
                    join(
                        canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                        `${deploy.segmentId}`,
                        "multisig.run.json"
                    )
                )
                const safeApi = new SafeApiKit({chainId: BigInt(SEPOLIA_CHAIN_ID)})
                const txn = await safeApi.getTransaction(multisigDeploy!.safeTxHash);
                if (txn) {
                    await user.metadataStore!.updateJSON(
                        join(
                            canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                            `${deploy.segmentId}`,
                            "multisig.transaction.json"
                        ),
                        txn,
                    )
                }

                if (!txn.isExecuted) {
                    console.log(chalk.cyan(`SafeTxn(${multisigDeploy!.safeTxHash}): still waiting for execution.`))
                    console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy!.safeAddress}`)
                    console.error(`Resume deploy with: `)
                    console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`);
                    return;
                } else if (!txn.isSuccessful) {
                    console.log(chalk.red(`SafeTxn(${multisigDeploy!.safeTxHash}): failed onchain. Failing deploy.`))
                    deploy.phase = 'failed';
                    await saveDeploy(user.metadataStore!, deploy);
                    continue;
                } else {
                    console.log(chalk.green(`SafeTxn(${multisigDeploy!.safeTxHash}): executed (${txn.transactionHash})`))
                    advance(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                }
                break;
            }
            case "multisig_wait_confirm": {
                const multisigTxn = await user.metadataStore!.getJSONFile<SafeMultisigTransactionResponse>(
                    join(
                        canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                        `${deploy.segmentId}`,
                        "multisig.transaction.json"
                    )
                )
                if (!multisigTxn) {
                    console.error(`Deploy missing multisig transaction data.`);
                    return;
                }

                if (multisigTxn.executionDate && multisigTxn.transactionHash) {
                    // check that the 
                    const client = createPublicClient({
                        chain: sepolia, 
                        transport: http(rpcUrl),
                    })
                    try {
                        const receipt = await client.getTransactionReceipt({hash: multisigTxn.transactionHash as `0x${string}`});
                        if (receipt.status === 'success') {
                            console.log(chalk.green(`SafeTxn(${multisigTxn.safeTxHash}): successful onchain (${receipt.transactionHash})`))
                            deploy.metadata[deploy.segmentId].confirmed = true;
                            advance(deploy);
                            await saveDeploy(user.metadataStore!, deploy);
                            if (deploy.segments[deploy.segmentId]) {
                                console.log(chalk.bold(`To continue running this transaction, re-run with --resume. Deploy will resume from phase: ${deploy.segments[deploy.segmentId].filename}`))
                                console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`);
                                return;
                            }
                            break;
                        } else {
                            console.log(chalk.green(`SafeTxn(${multisigTxn.safeTxHash}): reverted onchain (${receipt.transactionHash})`))
                            deploy.phase = 'failed';
                            await saveDeploy(user.metadataStore!, deploy);
                            break;
                        } 
                    } catch (e) {
                        console.error(`Multisig Transaction (${multisigTxn.transactionHash}) hasn't landed in a block yet.`)
                        console.error(`Re-run to check status:`)
                        console.error(`\t\tzeus deploy run --resume --env ${deploy.env}`);
                        console.error(e);
                        return;
                    }
                }   
                break;
            }
            default:
                console.error(`Deploy is in unknown phase: ${deploy.phase}. Make sure your zeus is up-to-date.`);
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
