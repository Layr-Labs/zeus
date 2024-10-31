import {command, positional, string} from 'cmd-ts';
import {json} from './args';
import { assertLoggedIn, loggedIn, requires, TState } from './inject';
import { runTest } from '../signing/strategies/test';
import * as allArgs from  './args';

const handler = async function(_user: TState, args: {script: string, env: string | undefined}) {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore.begin();
    const runContext = (args.env) ? {env: args.env} : undefined;
    try {
        const res = await runTest({upgradePath: args.script, txn, context: runContext});
        if (res.code !== 0) {
            throw new Error(`Test failed (${res.code})`, {cause: new Error(`Test failed with the following output:\n\t${res.stdout}\n\t${res.stderr}`)})
        }
    } catch (e) {
        console.error(`Test failed.`);
        throw e;
    } 
};

const cmd = command({
    name: 'test',
    description: 'Runs the test function of a migration, injecting the required parameters and deployed contract addresses.` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.envOptional,
        script: positional({
            type: string,
            description: 'Path to script to test.'
        })
    },
    handler: requires(handler, loggedIn),
})
export default cmd;