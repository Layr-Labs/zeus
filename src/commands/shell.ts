import {command} from 'cmd-ts';
import {json} from './args';
import { assertInRepo, withHost, requires, TState } from './inject';
import { loadExistingEnvs } from './env/cmd/list';
import * as allArgs from './args';
import { getActiveDeploy } from './deploy/cmd/utils';
import { injectableEnvForEnvironment } from './run';
import { spawn } from 'child_process';

const handler = async function(_user: TState, args: {env: string, pending: boolean}) {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore?.begin();
    const envs = await loadExistingEnvs(txn);

    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment.`);
        return;
    }

    const withDeploy = args.pending ? await getActiveDeploy(txn, args.env) : undefined;
    const env = await injectableEnvForEnvironment(txn, args.env, withDeploy?._.name);

    const shell = process.env.SHELL || '/bin/bash';
    const child = spawn(shell, {
        stdio: 'inherit', // inherit stdio so user can interact with shell
        env: {
            ...process.env,
            ...env
        },              // pass the custom env
      });
    
    // Optional: handle exit
    child.on('exit', (code: number) => {
        console.log(`Shell exited with code ${code}`);
    });
};

const cmd = command({
    name: 'shell',
    description: 'Enters a new shell, setting all relevant zeus env variables. Convenient for local testing.',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        pending: allArgs.pending,
    },
    handler: requires(handler, withHost),
})
export default cmd;