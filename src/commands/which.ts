import {command, option, optional, string} from 'cmd-ts';
import {json} from './args';
import { loggedIn, requires, TState } from './inject';
import * as allArgs from './args';

const handler = async function(user: TState, args: {json: boolean, contract: string | undefined, env: string}) {
    // load the latest contract addresses for `args.env`.
    //


};

const cmd = command({
    name: 'which',
    description: 'See a contract address on an environment (or all contract addresses!)` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        contract: option({
            type: optional(string),
            long: 'contract',
            short: 'c'
        })
    },
    handler: requires(handler, loggedIn),
})
export default cmd;