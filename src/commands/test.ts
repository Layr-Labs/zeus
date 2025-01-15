import {command, restPositionals, string} from 'cmd-ts';
import {json} from './args';
import { assertInRepo, inRepo, requires, TState } from './inject';
import { runTest } from '../signing/strategies/test';
import * as allArgs from  './args';
import chalk from 'chalk';

const handler = async function(_user: TState, args: {scripts: string[], rpcUrl: string | undefined, env: string | undefined, verbose: boolean}) {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin();
    const runContext = (args.env) ? {env: args.env} : undefined;
    const result: Record<string, boolean> = {};
    const verboseHelp = args.verbose ? '' : chalk.italic(`(for full output, re-run with --verbose)`); 
    const timeTakenMs: Record<string, number> = {};

    await Promise.all(args.scripts.map(async (script) => {
        const start = Date.now()
        try {
            const res = await runTest({upgradePath: script, rpcUrl: args.rpcUrl, txn, context: runContext, verbose: args.verbose, json: false, rawOutput: true});
            timeTakenMs[script] = Date.now() - start;
            if (res.code !== 0) {
                console.error(`❌ [${script}] - test failed ${verboseHelp}`);
                result[script] = false;
                return;
            } else {
                result[script] = true;
            }
        } catch (e) {
            result[script] = false;
            timeTakenMs[script] = Date.now() - start;
            console.error(`❌ [${script}] - test failed ${verboseHelp}`, e);
        } 
    }));
    const anyFailures = Object.values(result).filter(v => v === false);
    const isSuccess = !anyFailures || anyFailures.length === 0; // no failures.
    if (isSuccess) {
        console.log(`✅ ${args.scripts.length} test${args.scripts.length > 1 ? 's' : ''} succeeded ${verboseHelp}`)
    } else {
        const plural = (count: number) => count > 1 ? `s` : `` 
        console.error(`❌ ${anyFailures.length} test${plural(anyFailures.length)} failed, ${Object.keys(result).length - anyFailures.length} succeeded. ${verboseHelp}`)
    }

    Object.keys(result).sort().forEach(script => {
        console.log(`\t${result[script] === true ? chalk.green('✔️') : chalk.red('✖️')}  ${script}      [${timeTakenMs[script]}ms]`);
    })
    
    if (anyFailures.length > 0) {
        throw new Error(`${anyFailures.length} test(s) failed.`);
    }
};

const cmd = command({
    name: 'test',
    description: 'Runs the test function of a migration, injecting the required parameters and deployed contract addresses.` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        rpcUrl: allArgs.rpcUrl,
        verbose: allArgs.verbose,
        scripts: restPositionals({
            type: string,
            description: 'Path to script to test.'
        })
    },
    handler: requires(handler, inRepo),
})
export default cmd;