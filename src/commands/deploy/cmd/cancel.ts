import { command } from "cmd-ts";
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from "../../inject";
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
            return true;
        case 'multisig':
            return deploy.phase === 'multisig_start' || deploy.phase === 'multisig_wait_signers' || deploy.phase === 'multisig_execute'
    }
}

async function handler(_user: TState, {env}: {env: string}) {
    const user = assertLoggedIn(_user);

    const txn = await user.metadataStore.begin();
    const deploy = await getActiveDeploy(txn, env);
    if (!deploy) {
        console.error(`No active deploy for environment '${env}'.`);
        return;
    }

    if (!isCancelleable(deploy._)) {
        console.error(`Deploy ${deploy._.name} cannot be cancelled.`)
        return;
    }

    const strategy =  await promptForStrategy(deploy, txn, "Cancelling this deploy may require submitting another multisig transaction, with the same nonce, to replace the outstanding one. How would you like to sign this?");
    try {
        await strategy.cancel(deploy);
        await updateLatestDeploy(txn, env, undefined, true);
        await txn.commit(`Cancelled deploy ${deploy._.name}`);
        console.log(`Cancelled ${deploy._.name}.`);
    } catch (e) {
        console.error(`Cancel deploy: ${deploy._.name} - failed.`)
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
