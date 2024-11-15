import {command, restPositionals, string} from 'cmd-ts';
import {json} from './args';
import { assertLoggedIn, loggedIn, requires, TState } from './inject';
import { runTest } from '../signing/strategies/test';
import * as allArgs from  './args';
import chalk from 'chalk';

const handler = async function(_user: TState, args: {scripts: string[], env: string | undefined, verbose: boolean}) {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore.begin();
    const runContext = (args.env) ? {env: args.env} : undefined;
    const result: Record<string, boolean> = {};
    args.scripts.forEach(async (script) => {
        try {
            const res = await runTest({upgradePath: script, txn, context: runContext, verbose: args.verbose});
            if (res.code !== 0 || !res.forge.output.success) {
                console.error(`❌ [${script}] - test failed (for full output, re-run with --verbose)`, {cause: e});
                result[script] = false;
                return;
            }
            result[script] = true;
        } catch (e) {
            result[script] = false;
            console.error(`❌ [${script}] - test failed (for full output, re-run with --verbose)`, {cause: e});
            throw e;
        } 
    });

    const failures = Object.values(result).find(v => v === false);
    const isSuccess = !failures; // no failures.
    if (isSuccess) {
        console.log(`✅ ${args.scripts.length} test${args.scripts.length > 1 ? 's' : ''} succeeded ${chalk.italic('(for full output, re-run with --verbose)')}`)
    } else {
        throw new Error(`❌ [${failures}/${Object.keys(result).length}] not all tests succeeded`)
    }
};

const cmd = command({
    name: 'test',
    description: 'Runs the test function of a migration, injecting the required parameters and deployed contract addresses.` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        verbose: allArgs.verbose,
        scripts: restPositionals({
            type: string,
            description: 'Path to script to test.'
        })
    },
    handler: requires(handler, loggedIn),
})
export default cmd;