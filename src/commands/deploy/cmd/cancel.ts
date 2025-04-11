import { command } from "cmd-ts";
import { assertLoggedIn, withHost, loggedIn, requires, TState } from "../../inject";
import { getActiveDeploy, updateLatestDeploy } from "./utils";
import * as allArgs from '../../args';
import EOAHandler from '../../../deploy/handlers/eoa'
import MultisigHandler from '../../../deploy/handlers/gnosis'
import ScriptHandler from '../../../deploy/handlers/script'
import SystemHandler from '../../../deploy/handlers/system'
import { TPhase } from "../../../metadata/schema";

const handlers: Record<TPhase['type'], typeof EOAHandler.cancel> = {
    "eoa": EOAHandler.cancel,
    "multisig": MultisigHandler.cancel,
    "script": ScriptHandler.cancel,
    "system": SystemHandler.cancel
}

async function handler(_user: TState, {env}: {env: string}) {
    const user = assertLoggedIn(_user);

    const txn = await user.metadataStore.begin();
    const deploy = await getActiveDeploy(txn, env);
    if (!deploy) {
        console.error(`No active deploy for environment '${env}'.`);
        return;
    }

    const cancelHandler = handlers[deploy._.segments[deploy._.segmentId].type]

    try {
        if (cancelHandler) {
            await cancelHandler(deploy, txn, undefined);
        }
    
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
    handler: requires(handler, loggedIn, withHost),
})

export default cmd;
