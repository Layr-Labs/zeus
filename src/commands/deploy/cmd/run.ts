import { command, positional, string } from "cmd-ts";
import { json } from "../../common.js";
import { requiresLogin, TState } from "../../inject.js";
import { getActiveDeploy, isTerminalPhase, TDeploy, TDeployPhase } from "./utils.js";

async function handler(user: TState, args: {env: string, json: boolean, upgrade: string}) {
    const deploy = await getActiveDeploy(user, args.env);
    if (deploy) {
        console.log(`Resuming existing deploy... (began at ${deploy.startTime})`);
        // double check the upgrade is correct
        executeDeploy(deploy);
        return;
    }

    executeDeploy({
        upgradeScript: args.upgrade,
        phase: undefined,
        startTime: new Date().toString(),
        endTime: '',
    });
}

const executeDeploy = (deploy: TDeploy) => {
    while (!isTerminalPhase(deploy.phase)) {
        switch (deploy.phase) {
            case "create":
                // TODO: Handle the `create` phase
                break;
            case "wait_create_confirm":
                // TODO: Handle waiting for confirmation of create transactions
                break;
            case "queue":
                // TODO: Handle the `queue` phase
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
                // TODO: Handle the `execute` phase
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
            case undefined:
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
