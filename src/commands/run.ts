import {command, option} from 'cmd-ts';
import {json} from './args';
import { loggedIn, requires } from './inject';

// user: TState, args: {json: boolean, command: string, env: string}
const handler = async function() {
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
    handler: requires(handler, loggedIn),
})
export default cmd;