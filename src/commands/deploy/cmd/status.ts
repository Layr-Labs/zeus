import { command, positional, string } from "cmd-ts";
import { inRepo, loggedIn, requires, TState } from "../../inject";
import { canonicalPaths } from "../../../metadata/paths";
import { TDeployManifest } from "../../../metadata/schema";
import chalk from "chalk";

async function handler(user: TState, {env}: {env: string}) {
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await user.metadataStore!.getJSONFile<TDeployManifest>(deployManifestPath) ?? {};
    if (deployManifest.inProgressDeploy) {
        console.log(chalk.green(`Deploy in progress!`))
    } else {
        console.log(`No deploy in progress.`);
    }    
}

const cmd = command({
    name: 'status',
    description: '',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
    },
    handler: requires(handler, loggedIn, inRepo),
})

export default cmd;
