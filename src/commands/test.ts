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
    const verboseHelp = args.verbose ? '' : chalk.italic(`(for full output, re-run with --verbose)`); 
    const timeTakenMs: Record<string, number> = {};

    await Promise.all(args.scripts.map(async (script) => {
        try {
            const start = Date.now()
            const res = await runTest({upgradePath: script, txn, context: runContext, verbose: args.verbose});
            timeTakenMs[script] = Date.now() - start;
            if (res.code !== 0 || !res.forge.output.success) {
                console.error(`❌ [${script}] - test failed ${verboseHelp}`);
                result[script] = false;
                return;
            } else {
                result[script] = true;
            }
        } catch (e) {
            result[script] = false;
            console.error(`❌ [${script}] - test failed ${verboseHelp}`, {cause: e});
        } 
    }));
    const anyFailures = Object.values(result).filter(v => v === false);
    const isSuccess = !anyFailures || anyFailures.length === 0; // no failures.
    if (isSuccess) {
        console.log(`✅ ${args.scripts.length} test${args.scripts.length > 1 ? 's' : ''} succeeded ${verboseHelp}`)
    } else {
        console.error(`❌ [${anyFailures.length}/${Object.keys(result).length}] failing. ${verboseHelp}`)
    }

    Object.keys(result).forEach(script => {
        console.log(`\t${result[script] === true ? chalk.green('✔️') : chalk.red('✖️')}  ${script}      [${timeTakenMs[script]}ms]`);
    })
    
    process.exit(anyFailures.length);
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