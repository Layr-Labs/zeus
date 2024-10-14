import { command } from "cmd-ts";
import { inRepo, loggedIn, requires, TState } from "../../inject";
import { getActiveDeploy, updateLatestDeploy } from "./utils";
import * as allArgs from '../../args';

async function handler(user: TState, {env}: any) {
    const deploy = await getActiveDeploy(user, env);
    if (!deploy) {
        console.error(`No active deploy for environment '${env}'.`);
        return;
    }

    // TODO:(milestone1) determine whether `deploy` is cancellable.

    try {
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
