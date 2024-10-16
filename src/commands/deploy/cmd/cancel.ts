import { command } from "cmd-ts";
import { inRepo, loggedIn, requires, TState } from "../../inject";
import { getActiveDeploy, promptForStrategy, updateLatestDeploy } from "./utils";
import * as allArgs from '../../args';
import { TDeploy } from "../../../metadata/schema";

function isCancelleable(deploy: TDeploy): boolean {
    switch (deploy.phase) {
        case '':
        case 'cancelled':
            return true;
        case 'complete':
            // you can't cancel a complete deploy...
            return false;
    }

    const segment = deploy.segments[deploy.segmentId];
    switch (segment.type) {
        case 'eoa':
            return false; // you can't really stop the EOA deploy, since it deploys contracts and updates immediately.
        case 'multisig':
            return deploy.phase === 'multisig_start' || deploy.phase === 'multisig_wait_signers' || deploy.phase === 'multisig_execute'
    }
}

async function handler(user: TState, {env}: {env: string}) {
    const deploy = await getActiveDeploy(user, env);
    if (!deploy) {
        console.error(`No active deploy for environment '${env}'.`);
        return;
    }

    if (!isCancelleable(deploy)) {
        console.error(`Deploy ${deploy.name} cannot be cancelled.`)
        return;
    }

    const strategy =  await promptForStrategy(deploy, user.metadataStore!, "Cancelling this deploy requires submitting another multisig transaction, with the same nonce, to replace the outstanding one. How would you like to sign this?");
    try {
        await strategy.cancel(deploy, user);
        await updateLatestDeploy(user.metadataStore!, env, undefined, true);
        console.log(`Cancelled ${deploy.name}.`);
    } catch (e) {
        console.error(`Cancel deploy: ${deploy.name} - failed.`)
        console.error(e);
        return;
    }
}

const cmd = command({
    name: 'cancel',
    description: '',
    version: '1.0.0',
    args: {
        env: allArgs.env
    },
    handler: requires(handler, loggedIn, inRepo),
})

export default cmd;
