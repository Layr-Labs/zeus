import { command } from "cmd-ts";
import * as allArgs from '../../args.js';
import { TState, configs, getRepoRoot, requires, loggedIn } from "../../inject.js";
import { getActiveDeploy, isTerminalPhase, advance } from "./utils.js";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { all } from '../../../signing/strategies/strategies.js';
import { Strategy } from "../../../signing/strategy.js";
import chalk from "chalk";
import { canonicalPaths } from "../../../metadata/paths.js";
import { MetadataStore } from "../../../metadata/metadataStore.js";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import ora from 'ora';
import fs from 'fs';
import { Segment, TDeploy, TDeployManifest, TDeployPhase, TSegmentType } from "../../../metadata/schema.js";

export const supportedSigners: Record<TSegmentType, string[]> = {
    "eoa": ["eoa", "ledger"],
    "multisig": ["gnosis.eoa", "gnosis.ledger"],
}

process.on("unhandledRejection", (error) => {
    console.error(error); // This prints error with stack included (as for normal errors)
    throw error; // Following best practices re-throw error and let the process exit with error code
  });

const blankDeploy = (args: {env: string, upgrade: string, upgradePath: string, name: string, segments: Segment[]}) => {
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

async function handler(user: TState, args: {env: string, resume: boolean, rpcUrl: string | undefined, json: boolean, upgrade: string, signingStrategy: string | undefined}) {
    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        return;
    }

    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        const signingStrategyClass = args.signingStrategy ? all.find((strategy) => new strategy(deploy, args, user.metadataStore!).id === args.signingStrategy) : undefined;
        const signingStrategy = signingStrategyClass && new signingStrategyClass(deploy, args, user.metadataStore!);
        return await executeOrContinueDeploy(deploy, signingStrategy, user, args.rpcUrl);
    }

    const upgradePath = normalize(join(getRepoRoot(), repoConfig.migrationDirectory, args.upgrade))
    if (!existsSync(upgradePath) || !lstatSync(upgradePath).isDirectory() ) {
        console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory. (searching '${upgradePath}')`)
        return;
    }
    const blankDeployName = `${formatNow()}-${args.upgrade}`;

    let _id = 0;
    const segments = fs.readdirSync(upgradePath).filter(p => p.endsWith('.s.sol') && (p.includes('eoa') || p.includes('multisig'))).map<Segment>(p => {
        if (p.includes('eoa')) {
            // eoa
            return {
                id: _id++,
                filename: p,
                type: 'eoa'
            }
        } else {
            // multisig
            return {
                id: _id++,
                filename: p,
                type: 'multisig'
            }
        }
    });
    const newDeploy = blankDeploy({name: blankDeployName, env: args.env, upgrade: args.upgrade, upgradePath, segments});
    const signingStrategyClass = all.find((strategy) => new strategy(newDeploy, args, user!.metadataStore!).id === args.signingStrategy);
    
    const deployJsonPath = join(canonicalPaths.deployDirectory('', args.env, blankDeployName), "deploy.json");
    const signingStrategy = signingStrategyClass && new signingStrategyClass(newDeploy, args, user.metadataStore!); 
    // create the new deploy.
    await user!.metadataStore?.updateFile(
        deployJsonPath, 
        '{}',
    )
    console.log(chalk.green(`+ creating deploy: ${deployJsonPath}`));
    console.log(chalk.green('+ started deploy'));

    await executeOrContinueDeploy(newDeploy, signingStrategy, user, args.rpcUrl);
}

const saveDeploy = async (metadataStore: MetadataStore, deploy: TDeploy) => {
    const deployJsonPath = join(
        canonicalPaths.deployDirectory('', deploy.env, deploy.name),
        "deploy.json"
    );
    await metadataStore.updateJSON<TDeploy>(
        deployJsonPath,
        deploy
    );
    console.log(chalk.green(`* updated deploy (${deployJsonPath})`))
}

const updateLatestDeploy = async (metadataStore: MetadataStore, env: string, deployName: string | undefined, forceOverride = false) => {
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await metadataStore.getJSONFile<TDeployManifest>(deployManifestPath) ?? {};
    if (deployManifest.inProgressDeploy && !forceOverride) {
        throw new Error('unexpected - deploy already in progress.');
    }    
    deployManifest.inProgressDeploy = deployName;
    await metadataStore.updateJSON<TDeployManifest>(deployManifestPath, deployManifest!);
}

const executeOrContinueDeploy = async (deploy: TDeploy, _strategy: Strategy<any> | undefined, user: TState, rpcUrl: string | undefined) => {
    while (true) {
        console.log(chalk.green(`[info] Deploy phase: ${deploy.phase}`))

        const getStrategy: () => Strategy<any> = () => {
            const segment = deploy.segments[deploy.segmentId];
            if (!_strategy) {
                console.error(`This phase requires a signing strategy. Please rerun with --signingStrategy [${supportedSigners[segment.type]?.join(' | ')}]`)
                process.exit(1);
            }
            if (Object.keys(supportedSigners).includes(deploy.phase) && !supportedSigners[segment.type]?.includes(_strategy.id)) {
                console.error(`This deploy phase does not support this signingStrategy. Please rerun with --signingStrategy [${supportedSigners[segment.type]?.join(' | ')}] `)
                process.exit(1);
            }
            return _strategy;
        }

        switch (deploy.phase) {
            // global states
            case "":
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                await updateLatestDeploy(user.metadataStore!, deploy.env, deploy.name);
                break;
            case "complete":
                console.log(`Deploy completed successfully!`);
                await updateLatestDeploy(user.metadataStore!, deploy.env, undefined, true);
                await saveDeploy(user.metadataStore!, deploy);
                return;
            case "cancelled":
                console.log(`Deploy failed.`);
                await updateLatestDeploy(user.metadataStore!, deploy.env, undefined, true);
                await saveDeploy(user.metadataStore!, deploy);
                return;
            // eoa states
            case "eoa_start":
                const script = join(deploy.upgradePath, deploy.segments[deploy.segmentId].filename);
                if (existsSync(script)) {
                    // TODO: check whether this deploy already has forge documents uploaded from a previous run.
                    // (i.e that it bailed before advancing.)
                    const sigRequest = await getStrategy().requestNew(script);
                    if (sigRequest?.ready) {
                        advance(deploy);
                        await saveDeploy(user.metadataStore!, deploy);
                        await user.metadataStore!.updateJSON(
                            join(
                                canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                                "foundry.run.json"
                            ),
                            sigRequest.forge?.runLatest
                        )
                        await user.metadataStore!.updateJSON(
                            join(
                                canonicalPaths.deployDirectory("", deploy.env, deploy.name),
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
                    console.error(`Fix your local copy and continue with --resume`);
                    return;
                }
                break;
            case "eoa_wait_confirm":
                // check the transactions created by the previous step.
                const foundryDeploy = await user.metadataStore?.getJSONFile<any>(
                    join(
                        canonicalPaths.deployDirectory("", deploy.env, deploy.name),
                        "foundry.deploy.json"
                    ),
                );
                if (!foundryDeploy) {
                    throw new Error('foundry.deploy.json was corrupted.');
                }

                // TODO:multicain
                const client = createPublicClient({
                    chain: mainnet, 
                    transport: http(rpcUrl),
                })

                const prompt = ora(`Verifying ${foundryDeploy.transactions.length} transactions...`);
                const spinner = prompt.start();

                for (let txn of foundryDeploy.transactions) {
                    const receipt = await client.getTransactionReceipt({hash: txn.hash});
                    if (receipt.status !== "success") {
                        console.error(`Transaction(${txn}) did not succeed: ${receipt.status}`)
                        return;
                        // TODO: what is the step forward here for the user?
                    }
                }
                spinner.stopAndPersist();
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                console.log(chalk.bold(`To continue running this transaction, re-run with the requested signer.`))
                return;

            // multisig states.
            case "multisig_start": {                
                const script = join(canonicalPaths.deployDirectory("", deploy.env, deploy.name), deploy.segments[deploy.segmentId].filename);
                if (existsSync(script)) {
                    const sigRequest = await getStrategy().requestNew(script);
                    console.log(sigRequest);
                    throw new Error('TODO: finish implementing queue step')
                } else {
                    console.error(`Missing expected script: ${script}. Please check your local copy and try again.`)
                    return;
                }
                break;
            }
            case "multisig_wait_signers":
                // TODO: check the gnosis api for whether the txns has enough sponsors.
                break;
            case "multisig_execute":
                // TODO: check the gnosis api to see if the txn executed onchain. execute it. log the result / txn.
                break;
            case "multisig_wait_confirm":
                // TODO: check the gnosis api to see if the txn executed successfully.
                break;
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
        signingStrategy: allArgs.signingStrategy,
        json: allArgs.json,
        rpcUrl: allArgs.rpcUrl,
        ...allArgs.signingStrategyFlags,
    },
    handler: requires(handler, loggedIn),
})
