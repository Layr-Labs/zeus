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

const blankDeploy = (args: {env: string, upgrade: string, upgradePath: string}) => {
    return {
        env: args.env,
        upgrade: args.upgrade,
        upgradePath: args.upgradePath,
        phase: "" as TDeployPhase,
        startTime: new Date().toString(),
        endTime: '',
    } as const;
}

async function handler(user: TState, args: {env: string, json: boolean, upgrade: string, signingStrategy: string}) {
    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        process.exit(1);
    }

    const upgradePath = normalize(join(getRepoRoot(), repoConfig.migrationDirectory, args.upgrade))
    if (!existsSync(upgradePath) || !lstatSync(upgradePath).isDirectory() ) {
        console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory. (searching '${upgradePath}')`)
        process.exit(1);
    }

    const newDeploy = blankDeploy({env: args.env, upgrade: args.upgrade, upgradePath});
    const signingStrategyClass = all.find((strategy) => new strategy(newDeploy, args, user!.metadataStore!).id === args.signingStrategy);
    if (!signingStrategyClass) {
        console.error(`No such signing strategy: ${args.signingStrategy}`);
        console.error(`Available strategies: ${all.map((s) => new s(newDeploy, args, user!.metadataStore!).id)}`);
        process.exit(1);
    }

    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        const signingStrategy = new signingStrategyClass(deploy, args, user.metadataStore!);
        // double check the upgrade is correct
        return await executeOrContinueDeploy(deploy, signingStrategy);
    }

    const signingStrategy = new signingStrategyClass(newDeploy, args, user.metadataStore!);
    await executeOrContinueDeploy(newDeploy, signingStrategy);
}

const executeOrContinueDeploy = async (deploy: TDeploy, strategy: Strategy<any>) => {
    while (!isTerminalPhase(deploy.phase)) {
        console.log(chalk.green(`[info] Deploy phase: ${deploy.phase}`))
        switch (deploy.phase) {
            case "":
                advance(deploy);
                break;
            case "create":
                const createScript = canonicalPaths.deploy(deploy.upgradePath);
                if (existsSync(createScript)) {
                    console.log("Running ", createScript)
                    const sigRequest = await strategy.requestNew(createScript);
                    if (sigRequest?.ready) {
                        advance(deploy);
                    }
                } else {
                    skip(deploy);
                }
                break;
            case "wait_create_confirm":
                // TODO: Handle waiting for confirmation of create transactions
                break;
            case "queue":
                if (existsSync(canonicalPaths.queue(deploy.upgradePath))) {
                    // TODO: run the queue.
                } else {
                    skip(deploy);
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
                    skip(deploy);
                }
                break;
            case "wait_execute_confirm":
                // TODO: Handle waiting for execute transaction confirmation
                break;
            case "complete":
                // TODO: Handle when the upgrade is complete
                break;
            case "cancelled":
                // TODO: Handle when the upgrade is cancelled
                break;
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
        signingStrategy: allArgs.signingStrategy,
        json: allArgs.json,
        ...allArgs.signingStrategyFlags,
    },
    handler: requires(handler, loggedIn),
})
