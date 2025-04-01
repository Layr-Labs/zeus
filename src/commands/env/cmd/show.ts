import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertInRepo, inRepo, requires, TState } from '../../inject';
import * as allArgs from '../../args';
import chalk from 'chalk';
import { loadExistingEnvs } from './list';
import { injectableEnvForEnvironment } from '../../run';
import { getActiveDeploy } from '../../deploy/cmd/utils';


async function handler(_user: TState, args: {json: boolean |undefined, env: string, pending: boolean}): Promise<void> {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin({verbose: true});
    const envs = await loadExistingEnvs(txn);

    const withDeploy = args.pending ? await getActiveDeploy(txn, args.env) : undefined;

    const targetEnv = envs.find(e => e.name === args.env);
    if (!targetEnv) {
        console.error(`No such environment '${args.env}`);
        return;
    }

    const env = await injectableEnvForEnvironment(txn, args.env, withDeploy?._.name);
    if (args.json) {
        console.log(JSON.stringify(env))
    } else {
        console.log(chalk.bold.underline(`Environment Parameters`))
        console.table(env);
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
    handler: requires(handler, inRepo),
})

export default cmd;