import {command} from 'cmd-ts';
import {json} from '../../args';
import { loggedIn, requires, TState } from '../../inject';

export const loadExistingEnvs = async (user: TState) => {
    const gh = user.github!;
    const zeusRepo = {
        owner: user.zeusHostOwner!,
        repo: user.zeusHostRepo!,
    };

    try {
        // List the contents of the 'environment' directory
        const { data: directoryContents } = await gh.rest.repos.getContent({
            ...zeusRepo,
            path: 'environment',
        });

        // Filter to only keep directories
        const existingEnvs = Array.isArray(directoryContents)
            ? directoryContents.filter(item => item.type === 'dir').map(item => item.name)
            : [];

        return existingEnvs;
    } catch (e) {
        if (`${e}`.includes('Not Found')) {
            // If the 'environment' folder does not exist yet, return an empty list
            return [];
        } else {
            throw e;
        }
    }
};

async function handler(user: TState, args: {json: boolean |undefined}): Promise<void> {
    const envs = await loadExistingEnvs(user);

    if (args.json) {
        console.log(JSON.stringify(envs));
    } else {
        if (envs && envs.length > 0) {
            console.log(`Found ${envs.length} environment${envs.length > 1 ? 's' : ''}:`)
            envs.forEach((env) => console.log(`\t- ${env}`));
        } else {
            console.log(`No environments yet. Create one with 'zeus env new'`);
        }
    }
}

const cmd = command({
    name: 'list',
    description: 'list available environments',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler, loggedIn),
})

export default cmd;