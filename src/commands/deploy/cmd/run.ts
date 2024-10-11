import { command } from "cmd-ts";
import * as allArgs from '../../args.js';
import { TState, configs, getRepoRoot, requires, loggedIn } from "../../inject.js";
import { getActiveDeploy, isTerminalPhase, skip, advance, TDeploy, TDeployPhase } from "./utils.js";
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
import { TDeployManifest } from "../../../metadata/schema.js";

export const supportedSigners: Partial<Record<TDeployPhase, string[]>> = {
    "create": ["eoa", "ledger"],
    "queue": ["gnosis.eoa", "gnosis.ledger"],
    "execute": ["gnosis.eoa", "gnosis.ledger"],
}

const blankDeploy = (args: {env: string, upgrade: string, upgradePath: string, name: string}) => {
    const start = new Date();
    return {
        name: args.name,
        env: args.env,
        upgrade: args.upgrade,
        upgradePath: args.upgradePath,
        phase: "" as TDeployPhase,
        startTime: start.toString(),
        startTimestamp: start.getTime() / 1000,
    } as TDeploy;
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
        process.exit(1);
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
        process.exit(1);
    }
    const blankDeployName = `${formatNow()}-${args.upgrade}`;
    const newDeploy = blankDeploy({name: blankDeployName, env: args.env, upgrade: args.upgrade, upgradePath});
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
            if (!_strategy) {
                console.error(`This phase requires a signing strategy. Please rerun with --signingStrategy [${supportedSigners[deploy.phase]?.join(' | ')}]`)
                process.exit(1);
            }
            if (Object.keys(supportedSigners).includes(deploy.phase) && !supportedSigners[deploy.phase]?.includes(_strategy.id)) {
                console.error(`This deploy phase does not support this signingStrategy. Please rerun with --signingStrategy [${supportedSigners[deploy.phase]?.join(' | ')}] `)
                process.exit(1);
            }
            return _strategy;
        }

        switch (deploy.phase) {
            case "":
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                await updateLatestDeploy(user.metadataStore!, deploy.env, deploy.name);
                break;
            case "create":
                const createScript = canonicalPaths.deploy(deploy.upgradePath);
                if (existsSync(createScript)) {
                    const sigRequest = await getStrategy().requestNew(createScript);
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
                        process.exit(1);
                    }
                } else {
                    skip(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                }
                break;
            case "wait_create_confirm":
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
                        process.exit(1);
                        // TODO: what is the step forward here for the user?
                    }
                }
                spinner.stopAndPersist();
                advance(deploy);
                await saveDeploy(user.metadataStore!, deploy);
                console.log(chalk.bold(`To continue running this transaction, re-run with the requested signer.`))
                return;
            case "queue":
                if (existsSync(canonicalPaths.queue(deploy.upgradePath))) {
                    // TODO: run the queue.
                    throw new Error('TODO: implement queue step')
                } else {
                    console.log(`[info] No queue script, skipping.`);
                    skip(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                }
                break;
            case "wait_queue_find_signers":
                // TODO: Handle waiting for queue transactions to find signers
                break;
            case "wait_queue_confirm":
                // TODO: Handle waiting for queue transactions confirmation
                break;
            case "wait_queue_timelock":
                // TODO: Handle timelock waiting
                break;
            case "execute":
                if (existsSync(canonicalPaths.execute(deploy.upgradePath))) {
                    // TODO: run the execute phase.
                } else {
                    console.log(`[info] No execute step, skipping.`)
                    skip(deploy);
                    await saveDeploy(user.metadataStore!, deploy);
                }
                break;
            case "wait_execute_confirm":
                // TODO: Handle waiting for execute transaction confirmation
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
            default:
                // TODO: Handle unknown phase
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
