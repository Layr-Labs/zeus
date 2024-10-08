import { command, positional, string } from "cmd-ts";
import { json } from "../../common.js";
import { requiresLogin, TState, configs, getRepoRoot } from "../../inject.js";
import { getActiveDeploy, isTerminalPhase, skip, TDeploy, TDeployPhase } from "./utils.js";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";

const canonicalPaths = {
    deploy: (upgradeDir: string) => join(upgradeDir, "1-deploy.s.sol"),
    queue: (upgradeDir: string) => join(upgradeDir, "2-queue.s.sol"),
    execute: (upgradeDir: string) => join(upgradeDir, "3-execute.s.sol"),
}

async function handler(user: TState, args: {env: string, json: boolean, upgrade: string}) {
    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        // double check the upgrade is correct
        executeDeploy(deploy);
        return;
    }

    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        process.exit(1);
    }

    // resolve the relative path
    const upgradePath = normalize(join(getRepoRoot(), repoConfig.migrationDirectory, args.upgrade))
    if (!existsSync(upgradePath) || !lstatSync(upgradePath).isDirectory() ) {
        console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory.`)
        process.exit(1);
    }

    executeDeploy({
        upgradePath,
        phase: "",
        startTime: new Date().toString(),
        endTime: '',
    });
}

const executeDeploy = (deploy: TDeploy) => {
    while (!isTerminalPhase(deploy.phase)) {
        switch (deploy.phase) {
            case "create":
                if (existsSync(canonicalPaths.deploy(deploy.upgradePath))) {
                    // TODO: run the deploy.
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
            case "":
                // TODO: Handle undefined phase
                break;
            default:
                // TODO: Handle unknown phase
        }
    }
}



const cmd = command({
    name: 'run',
    description: 'Deploy an upgrade onto an environment. `zeus deploy <environment> <upgrade>`',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        upgrade: positional({ type: string, displayName: 'upgrade' }),
        json,
    },
    handler: requiresLogin(handler),
})

export default cmd;
