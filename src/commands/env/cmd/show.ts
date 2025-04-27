import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertInRepo, withHost, requires, TState } from '../../inject';
import * as allArgs from '../../args';
import chalk from 'chalk';
import { loadExistingEnvs } from './list';
import { injectableEnvForEnvironment } from '../../run';
import { getActiveDeploy } from '../../deploy/cmd/utils';


export async function handler(_user: TState, args: {json: boolean |undefined, env: string, pending: boolean}): Promise<void> {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin({verbose: true});
    const envs = await loadExistingEnvs(txn);

    const withDeploy = args.pending ? await getActiveDeploy(txn, args.env) : undefined;

    const targetEnv = envs.find(e => e.name === args.env);
    if (!targetEnv) {
        console.error(`No such environment '${args.env}`);
        return;
    }

    const preEnv =  await injectableEnvForEnvironment(txn, args.env);
    const env = await injectableEnvForEnvironment(txn, args.env, withDeploy?._.name);
    if (args.json) {
        console.log(JSON.stringify(env))
    } else {
        console.log(chalk.bold.underline(`Environment Parameters`))

        // highlight any parameters that have changed.
        if (withDeploy) {
            const keys = Object.keys(env);
            interface Item {
                name: string,
                value: string,
                dirty: string
            }
            const printableEnv: Item[] = [];
            for (const key of keys) {
                const item: Item = {
                    name: key,
                    value: env[key],
                    dirty: preEnv[key] !== env[key] ? '⬅️' : ''
                };
                printableEnv.push(item);
            } 
            console.table(printableEnv);
        } else {
            console.table(env);
        }
    }
}

const cmd = command({
    name: 'show',
    description: 'Show the injectable parameters and contracts for this environment.',
    version: '1.0.0',
    args: {
        pending: allArgs.pending,
        env: allArgs.envPositional,
        json,
    },
    handler: requires(handler, withHost),
})

export default cmd;