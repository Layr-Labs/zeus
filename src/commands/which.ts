import {command, option, optional, string} from 'cmd-ts';
import {json} from './args';
import { loggedIn, requires } from './inject';
import * as allArgs from './args';
// user: TState, args: {json: boolean, contract: string | undefined, env: string}
const handler = async function() {
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