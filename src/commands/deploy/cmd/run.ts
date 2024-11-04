import { command } from "cmd-ts";
import * as allArgs from '../../args';
import { TState, requires, loggedIn, isLoggedIn, TLoggedInState } from "../../inject";
import { configs, getRepoRoot } from '../../configs';
import { getActiveDeploy, updateLatestDeploy, advance, promptForStrategy, isTerminalPhase } from "./utils";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { TForgeRequest, TGnosisRequest } from "../../../signing/strategy";
import chalk from "chalk";
import { canonicalPaths } from "../../../metadata/paths";
import { createPublicClient, http, sha256 } from "viem";
import * as AllChains from "viem/chains";
import ora from 'ora';
import fs from 'fs';
import { ForgeSolidityMetadata, Segment, TDeploy, TDeployedContractsManifest, TDeployLock, TDeployPhase, TEnvironmentManifest, TTestOutput, TUpgrade } from "../../../metadata/schema";
import SafeApiKit from "@safe-global/api-kit";
import { SafeMultisigTransactionResponse} from '@safe-global/types-kit';
import { GnosisEOAStrategy } from "../../../signing/strategies/gnosis/api/gnosisEoa";
import semver from 'semver';
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { execSync } from "child_process";
import { runTest } from "../../../signing/strategies/test";
import { wouldYouLikeToContinue } from "../../prompts";

process.on("unhandledRejection", (error) => {
    console.error(error); // This prints error with stack included (as for normal errors)
    throw error; // Following best practices re-throw error and let the process exit with error code
});

const getChain = (chainId: number) => {
    const chain = Object.values(AllChains).find(value => value.id === chainId);
    if (!chain) {
        throw new Error(`Unsupported chain ${chainId}`);
    }
    return chain;
}

// check the transactions created by the previous step.
interface TFoundryDeploy {
    transactions: {
        hash: `0x${string}`
    }[] | undefined;
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

async function handler(_user: TState, args: {env: string, resume: boolean, rpcUrl: string | undefined, json: boolean, upgrade: string | undefined}) {
    if (!isLoggedIn(_user)) {
        return;
    }
    const user: TLoggedInState = _user;
    
    const metaTxn = await user.metadataStore.begin();

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
        return await executeOrContinueDeployWithLock(deploy._.name, deploy._.env, user, args.rpcUrl);
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

    const envManifest = await metaTxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    const newDeploy = blankDeploy({name: blankDeployName, chainId: envManifest._.chainId, env: args.env, upgrade: args.upgrade, upgradePath, segments});
    const deployJsonPath = canonicalPaths.deployStatus({env: args.env, name: blankDeployName});

    const deployJson = await metaTxn.getJSONFile<TDeploy>(deployJsonPath);
    deployJson._ = newDeploy;
    await deployJson.save();

    const upgradeManifest = await metaTxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(args.upgrade));
    if (!semver.satisfies(envManifest._.deployedVersion ?? '0.0.0', upgradeManifest._.from)) {
        console.error(`Unsupported upgrade. ${deployJson._.name} requires an environment meet the following version criteria: (${upgradeManifest._.from})`);
        console.error(`Environment ${deployJson._.env} is currently deployed at '${envManifest._.deployedVersion}'`);
        return;
    }

    console.log(chalk.green(`+ creating deploy: ${deployJsonPath}`));
    console.log(chalk.green(`+ started deploy (${envManifest?._.deployedVersion ?? '0.0.0'}) => (${upgradeManifest._.to}) (requires: ${upgradeManifest._.from})`));
    await metaTxn.commit(`started deploy: ${deployJson._.env}/${deployJson._.name}`);
    await executeOrContinueDeployWithLock(deployJson._.name, deployJson._.env, user, args.rpcUrl);
}

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

const currentUser = () => execSync('git config --global user.email').toString('utf-8').trim();

const releaseDeployLock: (deploy: TDeploy, txn: Transaction) => Promise<void> = async (deploy, txn) => {
    const deployLock = await txn.getJSONFile<TDeployLock>(canonicalPaths.deployLock(deploy));
    if (deployLock._.holder !== currentUser()) {
        console.warn(`Cannot release deploy lock for ${deploy.env} -- you do not own this lock. (got: ${deployLock._.holder}, expected: ${currentUser()})`);
        return;
    }

    deployLock._.holder = undefined;
    deployLock._.description = undefined;
    deployLock._.untilTimestampMs = undefined;
    await deployLock.save();
}

const acquireDeployLock: (deploy: TDeploy, txn: Transaction) => Promise<boolean> = async (deploy, txn) => {
    try {
        const deployLock = await txn.getJSONFile<TDeployLock>(canonicalPaths.deployLock(deploy));
        const currentEmail = currentUser();

        const acquireLock = async () => {
            deployLock._.description = `Deploy ${deploy.name} - ${deploy.segmentId}/${deploy.phase}`;
            deployLock._.holder = currentEmail;
            deployLock._.untilTimestampMs = Date.now() + (5 * MINUTES);
            await deployLock.save();
            return true;
        }
        const isEmptyLock = !deployLock._.holder;
        if (isEmptyLock) {
            return await acquireLock();
        }

        const isStaleLock = deployLock._.holder && deployLock._.untilTimestampMs && (deployLock._.untilTimestampMs < Date.now());
        if (isStaleLock) {
            // lock expired.
            console.warn(`Warning: taking expired deploy lock from ${deployLock._.holder} (${deployLock._.description})`)
            console.warn(`You might clobber their deploy. Check 'zeus deploy status' for more information...`);
            return await acquireLock();
        }

        const isMyLock = deployLock._.holder === currentEmail;
        if (isMyLock) {
            // you already have the lock for this deploy. you can resume / continue as needed.
            return true;
        }

        console.error(`Deploy lock held by ${deployLock._.holder} (expires ${new Date(deployLock._.untilTimestampMs ?? 0)})`)
        return false;
    } catch (e) {
        console.error(`An error occurred acquiring the deploy lock: ${e}`);
        return false;
    }
};

const executeOrContinueDeployWithLock = async (name: string, env: string, user: TLoggedInState, rpcUrl: string | undefined) => {
    const txn = await user.metadataStore.begin();
    const deploy = await txn.getJSONFile<TDeploy>(canonicalPaths.deployStatus({name, env}))
    const isLocked = await acquireDeployLock(deploy._, txn)
    if (!isLocked) {
        console.error(`Fatal: failed to acquire deploy lock.`);
        return;
    } else {
        if (txn.hasChanges()) {
            await txn.commit(`acquired deploy lock`);
        }
    }

    try {
        const txn = await user.metadataStore.begin();
        const deploy = await txn.getJSONFile<TDeploy>(canonicalPaths.deployStatus({name, env}))
        await executeOrContinueDeploy(deploy, user, txn, rpcUrl);
        if (txn.hasChanges()) {
            console.warn(`Deploy failed to save all changes. If you didn't manually exit, this could be a bug.`)
        }
    } finally {
        const tx = await user.metadataStore.begin();
        await releaseDeployLock(deploy._, tx);
        await tx.commit('releasing deploy lock');
    }
}

const executeOrContinueDeploy = async (deploy: SavebleDocument<TDeploy>, _user: TState, metatxn: Transaction, rpcUrl: string | undefined) => {
    try {
        while (true) {
            console.log(chalk.green(`[${deploy._.segments[deploy._.segmentId]?.filename ?? '<none>'}] ${deploy._.phase}`))
            
            switch (deploy._.phase) {
                // global states
                case "":
                    await advance(deploy);
                    await deploy.save()
                    await updateLatestDeploy(metatxn, deploy._.env, deploy._.name);
                    break;
                case "complete": {
                    const envManifest = await metatxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deploy._.env));
                    if (!envManifest) {
                        console.error(`Corrupted env manifest.`);
                        return;
                    }
                    
                    // update environment's latest deployed contracts.
                    const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
                    if (deployedContracts._?.contracts?.length && deployedContracts._?.contracts?.length > 0) {
                        if (!envManifest._.contracts) {
                            envManifest._.contracts = {static: {}, instances: []};
                        }
                        const deployedStatic = Object.fromEntries(deployedContracts._.contracts.filter(t => t.singleton).map(t => [t.contract, t]));
                        const deployedInstances = deployedContracts._.contracts.filter(t => !t.singleton);

                        const updatedStatics = 
                            Object.fromEntries(
                                Object.keys(deployedStatic)
                                    .filter(contract => deployedStatic[contract].address !== envManifest._.contracts.static[contract].address)
                                    .map(contract => [['name', contract], ['old', envManifest._.contracts.static[contract]?.address ?? '<none>'], ['new', deployedStatic[contract].address]])
                            );
                        if (updatedStatics) {
                            console.log(chalk.bold.underline(`Updated static contracts:`))
                            console.log()
                            console.table(updatedStatics)
                            console.log()
                        }

                        envManifest._.contracts.static = {
                            ...envManifest._.contracts.static,
                            ...deployedStatic,
                        }
                        envManifest._.contracts.instances = [
                            ...(envManifest._.contracts.instances ?? []),
                            ...deployedInstances
                        ];
                    }

                    console.log(`Deploy completed. ✅`);
                    await updateLatestDeploy(metatxn, deploy._.env, undefined, true);

                    const upgrade = await metatxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(deploy._.upgrade));
                    if (!upgrade) {
                        console.error(`No upgrade manifest for '${deploy._.upgrade}' found.`);
                        return;
                    }
                    envManifest._.deployedVersion = upgrade._.to;
                    envManifest._.latestDeployedCommit = upgrade._.commit;

                    envManifest.save();
                    deploy.save();
                    await metatxn.commit(`Deploy ${deploy._.name} completed!`);
                    return;
                }
                case "failed": {
                    console.error(`The deploy failed. ❌`);
                    await updateLatestDeploy(metatxn, deploy._.env, undefined, true);
                    await metatxn.commit(`Deploy ${deploy._.name} failed.`);
                    return;
                }
                case "cancelled":
                    console.log(`Deploy was cancelled. ❌`);
                    await updateLatestDeploy(metatxn, deploy._.env, undefined, true);
                    await deploy.save();
                    await metatxn.commit(`Deploy ${deploy._.name} cancelled.`);
                    return;
                // eoa states
                case "eoa_validate": {
                    const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);
                    if (!existsSync(script)) {
                        console.error(`Missing expected script: ${script}`);
                        console.error(`Fix your local copy and continue with: `);
                        console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`)
                        return;
                    }
                    const prompt = ora(`Running 'zeus test'`);
                    const spinner = prompt.start();
                    try {
                        const res = await runTest({upgradePath: script, txn: metatxn, context: {env: deploy._.env, deploy: deploy._.name}, verbose: false})
                        const testOutput = await metatxn.getJSONFile<TTestOutput>(canonicalPaths.testRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                        testOutput._ = res;
                        await testOutput.save();
                        spinner.stopAndPersist({suffixText: '✅'});
                    } catch {
                        spinner.stopAndPersist({suffixText: '❌'})
                    }

                    console.log(`Zeus would like to simulate this EOA transaction before attempting it for real. Please choose the method you'll use to sign:`)
                    const strategy =  await promptForStrategy(deploy, metatxn);
                    const sigRequest = await strategy.prepare(script, deploy._) as TForgeRequest;
                    console.log(chalk.yellow(`Please reviewing the following: `))
                    console.log(chalk.yellow(`=====================================================================================`))
                    console.log(chalk.bold.underline(`Forge output: `))
                    console.log(JSON.stringify(sigRequest.forge, null, 2));
                    console.log(JSON.stringify(sigRequest.output, null, 2));
                    console.log(chalk.bold.underline(`Deployed Contracts: `))
                    if (sigRequest.deployedContracts) {
                        console.table(sigRequest.deployedContracts)
                    } else {
                        console.log(chalk.bold(`<none>`));
                    }
                    console.log(chalk.yellow(`=====================================================================================`))
                    if (!await wouldYouLikeToContinue()) {
                        return;
                    }

                    await advance(deploy);
                    await deploy.save();
                    await metatxn.commit(`[deploy ${deploy._.name}] eoa test`);
                    console.log(chalk.green(`+ recorded successful test run`));

                    break;
                }
                case "eoa_start": {
                    const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);
                    if (existsSync(script)) {
                        // TODO: check whether this deploy already has forge documents uploaded from a previous run.
                        // (i.e that it bailed before advancing.)
                        const strategy =  await promptForStrategy(deploy, metatxn);
                        const sigRequest = await strategy.requestNew(script, deploy._) as TForgeRequest;
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
                            const withDeployedBytecodeHashes = sigRequest.deployedContracts?.map((contract) => {
                                const contractInfo = JSON.parse(fs.readFileSync(canonicalPaths.contractInformation(getRepoRoot(), contract.contract), 'utf-8')) as ForgeSolidityMetadata;
                                return {
                                    ...contract,
                                    deployedBytecodeHash: sha256(contractInfo.deployedBytecode.object),
                                    lastUpdatedIn: {
                                        name: deploy._.name,
                                        phase: deploy._.phase,
                                        segment: deploy._.segmentId
                                    },
                                };
                            }) || [];

                            const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
                            if (!deployedContracts._.contracts) {
                                deployedContracts._.contracts = [];
                            }

                            deployedContracts._.contracts.push(...withDeployedBytecodeHashes);
                            await deployedContracts.save();

                            if (withDeployedBytecodeHashes) {
                                console.log(`Deployed Contracts:`);
                                console.table(withDeployedBytecodeHashes);
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
                        return;
                    }
                    break;
                }
                case "eoa_wait_confirm": {
                    const foundryDeploy = await metatxn.getJSONFile<TFoundryDeploy>(
                        canonicalPaths.foundryDeploy({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})    
                    );

                    if (!foundryDeploy) {
                        throw new Error('foundry.deploy.json was corrupted.');
                    }

                    const client = createPublicClient({
                        chain: getChain(deploy._.chainId), 
                        transport: http(rpcUrl),
                    })
                    if (foundryDeploy._.transactions?.length) {
                        const prompt = ora(`Verifying ${foundryDeploy._.transactions?.length ?? 0} transactions...`);
                        const spinner = prompt.start();
                        for (const txn of (foundryDeploy._.transactions ?? [])) {
                            if (txn?.hash) {
                                const receipt = await client.getTransactionReceipt({hash: txn.hash});
                                if (receipt.status !== "success") {
                                    console.error(`Transaction(${txn}) did not succeed: ${receipt.status}`)
                                    return;
                                    // TODO: what is the step forward here for the user? (push deploy back a phase)
                                }
                            }
                        }
                        spinner.stopAndPersist();
                    }

                    deploy._.metadata[deploy._.segmentId].confirmed = true;
                    await advance(deploy);
                    await deploy.save();
                    await metatxn.commit(`[deploy ${deploy._.name}] eoa transaction confirmed`);

                    if (deploy._.segments[deploy._.segmentId] && !isTerminalPhase(deploy._.phase)) {
                        console.log(chalk.bold(`To continue running this upgrade, re-run with --resume. Deploy will resume from phase: ${deploy._.segments[deploy._.segmentId].filename}`))
                        console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                        return;
                    }
                    break;
                }
                // multisig states.
                case "multisig_start": {             
                    const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);   
                    if (existsSync(script)) {
                        const strategy =  await promptForStrategy(deploy, metatxn);
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
                        const multisigRun = await metatxn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                        multisigRun._ = sigRequest;
                        await multisigRun.save();
                        await advance(deploy);
                        await deploy.save();
                        await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction started`);
                    } else {
                        console.error(`Missing expected script: ${script}. Please check your local copy and try again.`)
                        return;
                    }
                    break;
                }
                case "multisig_wait_signers": {
                    const multisigDeploy = await metatxn.getJSONFile<TGnosisRequest>(
                        canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
                    )
                    const safeApi = new SafeApiKit({chainId: BigInt(deploy._.chainId)})
                    const multisigTxn = await safeApi.getTransaction(multisigDeploy._.safeTxHash);

                    if (multisigTxn.confirmations?.length === multisigTxn.confirmationsRequired) {
                        console.log(chalk.green(`SafeTxn(${multisigDeploy._.safeTxHash}): ${multisigTxn.confirmations?.length}/${multisigTxn.confirmationsRequired} confirmations received!`))
                        await advance(deploy);
                        await deploy.save();
                        await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction signers found`);
                    } else {
                        console.error(`Waiting on ${multisigTxn.confirmationsRequired - (multisigTxn.confirmations?.length ?? 0)} more confirmations. `)
                        console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                        console.error(`Run the following to continue: `);
                        console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                        return;
                    }
                    break;
                }
                case "multisig_execute": {
                    const multisigDeploy = await metatxn.getJSONFile<TGnosisRequest>(
                        canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
                    )
                    const safeApi = new SafeApiKit({chainId: BigInt(deploy._.chainId)})
                    const multisigTxn = await safeApi.getTransaction(multisigDeploy._.safeTxHash);

                    const multisigTxnPersist = await metatxn.getJSONFile(canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                    multisigTxnPersist._ = multisigTxn;
                    await multisigTxnPersist.save();
                    
                    if (!multisigTxn.isExecuted) {
                        console.log(chalk.cyan(`SafeTxn(${multisigDeploy._.safeTxHash}): still waiting for execution.`))
                        console.error(`\tShare the following URI: https://app.safe.global/transactions/queue?safe=${multisigDeploy._.safeAddress}`)
                        console.error(`Resume deploy with: `)
                        console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                        await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction awaiting execution`);
                        return;
                    } else if (!multisigTxn.isSuccessful) {
                        console.log(chalk.red(`SafeTxn(${multisigDeploy._.safeTxHash}): failed onchain. Failing deploy.`))
                        deploy._.phase = 'failed';
                        await deploy.save();
                        await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
                        continue;
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

                    if (!multisigTxn || !multisigTxn._) {
                        console.error(`Deploy missing multisig transaction data.`);
                        return;
                    }

                    if (multisigTxn._.executionDate && multisigTxn._.transactionHash) {
                        const client = createPublicClient({
                            chain: getChain(deploy._.chainId), 
                            transport: http(rpcUrl),
                        })
                        try {
                            const receipt = await client.getTransactionReceipt({hash: multisigTxn._.transactionHash as `0x${string}`});
                            if (receipt.status === 'success') {
                                console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): successful onchain (${receipt.transactionHash})`))
                                deploy._.metadata[deploy._.segmentId] = {...(deploy._.metadata[deploy._.segmentId] ?? {}), confirmed: true};
                                await advance(deploy);
                                await deploy.save();
                                
                                if (deploy._.segments[deploy._.segmentId] && !isTerminalPhase(deploy._.phase)) {
                                    console.log(chalk.bold(`To continue running this upgrade, re-run with --resume. Deploy will resume from phase: ${deploy._.segments[deploy._.segmentId].filename}`))
                                    console.error(`\t\tzeus deploy run --resume --env ${deploy._.env}`);
                                    await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction success`);
                                    return;
                                }
                                break;
                            } else {
                                console.log(chalk.green(`SafeTxn(${multisigTxn._.safeTxHash}): reverted onchain (${receipt.transactionHash})`))
                                deploy._.phase = 'failed';
                                await deploy.save();
                                await metatxn.commit(`[deploy ${deploy._.name}] multisig transaction failed`);
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
    } catch (e) {
        console.error(`See log output for more information on how to continue.`)
        console.error(`Full error:`)
        console.error(e);
        console.error();
        console.error(`An error occurred while running.`)
        if (metatxn.hasChanges()) {
            console.warn(`\tYour copy had outstanding changes that weren't committed.`)
            console.warn(`Modified files: `)
            console.warn(metatxn.toString());
        } else {
            console.log(`Your copy had no outstanding changes to commit.`);
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
