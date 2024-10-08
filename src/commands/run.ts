import {command, option} from 'cmd-ts';
import {json} from './args.js';
import { requiresLogin, TState } from './inject.js';

const handler = async function(user: TState, args: {json: boolean, command: string, env: string}) {
    // TODO:(milestone1) run `args.command` with latest contract addresses for the `$env` environment injected.
};

const cmd = command({
    name: 'run',
    description: 'run a command with all latest deployed contract addresses for a particular environment injected. Follows the format `export DEPLOYED_CONTRACTNAME="0x..."` ',
    version: '1.0.0',
    args: {
        json,
        env: option({long: 'environment', short: 'e'}),
        command: option({
            long: 'command',
            short: 'c',
        })
    },
    handler: requiresLogin(handler),
})
export default cmd;