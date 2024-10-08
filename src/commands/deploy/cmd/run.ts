import { command } from "cmd-ts";
import * as allArgs from '../../args.js';
import { requiresLogin, TState, configs, getRepoRoot } from "../../inject.js";
import { getActiveDeploy, isTerminalPhase, skip, advance, TDeploy } from "./utils.js";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { all } from '../../../signing/strategies/strategies.js';
import { SigningStrategy } from "../../../signing/signingStrategy.js";
import chalk from "chalk";

const canonicalPaths = {
    deploy: (upgradeDir: string) => join(upgradeDir, "1-deploy.s.sol"),
    queue: (upgradeDir: string) => join(upgradeDir, "2-queue.s.sol"),
    execute: (upgradeDir: string) => join(upgradeDir, "3-execute.s.sol"),
}

async function handler(user: TState, args: {env: string, json: boolean, upgrade: string, signingStrategy: string}) {
    const signingStrategyClass = all.find((strategy) => new strategy(args).id === args.signingStrategy);
    if (!signingStrategyClass) {
        console.error(`No such signing strategy: ${args.signingStrategy}`);
        console.error(`Available strategies: ${all.map((s) => new s(args).id)}`);
        process.exit(1);
    }
    const signingStrategy = new signingStrategyClass(args);
    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        // double check the upgrade is correct
        return await executeOrContinueDeploy(deploy, signingStrategy);
    }

    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        process.exit(1);
    }

    // resolve the relative path
    const upgradePath = normalize(join(getRepoRoot(), repoConfig.migrationDirectory, args.upgrade))
    if (!existsSync(upgradePath) || !lstatSync(upgradePath).isDirectory() ) {
        console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory. (searching '${upgradePath}')`)
        process.exit(1);
    }

    await executeOrContinueDeploy({
        upgradePath,
        phase: "",
        startTime: new Date().toString(),
        endTime: '',
    }, signingStrategy);
}

const executeOrContinueDeploy = async (deploy: TDeploy, strategy: SigningStrategy<any>) => {
    while (!isTerminalPhase(deploy.phase)) {
        console.log(chalk.green(`[info] Deploy phase: ${deploy.phase}`))
        switch (deploy.phase) {
            case "":
                advance(deploy);
                break;
            case "create":
                const createScript = canonicalPaths.deploy(deploy.upgradePath);
                if (existsSync(createScript)) {
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
    handler: requiresLogin(handler),
})
