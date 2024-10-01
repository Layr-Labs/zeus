import {command} from 'cmd-ts';
import { json } from '../../common.js';
import { requiresLogin, TState } from '../../inject.js';

const RESERVED_BRANCHES = ['main', 'master'];

export const loadExistingEnvs = async (user: TState) => {
    const { data: branches } = await user.github!.rest.repos.listBranches({
        owner: user.zeusHostOwner!,
        repo: user.zeusHostRepo!,
      });
  
    return branches.filter(branch => !RESERVED_BRANCHES.includes(branch.name));
}

async function handler(user: TState, args: {json: boolean |undefined}): Promise<void> {
    let envs = await loadExistingEnvs(user);

    if (args.json) {
        console.log(JSON.stringify(envs));
    } else {
        if (envs && envs.length > 0) {
            console.log(`Found ${envs.length} environment${envs.length > 1 ? 's' : ''}:`)
            envs.forEach((env) => console.log(`\t- ${env.name}`));
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
    handler: requiresLogin(handler),
})

export default cmd;