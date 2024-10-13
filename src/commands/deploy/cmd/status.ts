import { command, positional, string } from "cmd-ts";
import {json} from '../../args.js';
import { inRepo, loggedIn, requires, TState } from "../../inject.js";
import { canonicalPaths } from "../../../metadata/paths.js";
import { TDeployManifest } from "../../../metadata/schema.js";
import chalk from "chalk";

async function handler(user: TState, {env, json}: any) {
    
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await user.metadataStore!.getJSONFile<TDeployManifest>(deployManifestPath) ?? {};
    if (deployManifest.inProgressDeploy) {
        console.log(chalk.green(`Deploy in progress!`))
    }    
    


}

const cmd = command({
    name: 'status',
    description: '',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: requires(handler, loggedIn, inRepo),
})

export default cmd;
