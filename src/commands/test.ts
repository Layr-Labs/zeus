import {command, option} from 'cmd-ts';
import {json} from './args.js';
import { loggedIn, requires, TState } from './inject.js';

const handler = async function(user: TState, args: {json: boolean, command: string, env: string}) {
    // TODO:(milestone1): run the test with environment injected.
};

const cmd = command({
    name: 'test',
    description: 'Runs the test function of a migration, injecting the required parameters and deployed contract addresses.` ',
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