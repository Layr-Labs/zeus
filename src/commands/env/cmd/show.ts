import {command, flag} from 'cmd-ts';
import {json} from '../../args';
import { assertInRepo, withHost, requires, TState } from '../../inject';
import * as allArgs from '../../args';
import chalk from 'chalk';
import { loadExistingEnvs } from './list';
import { injectableEnvForEnvironment } from '../../run';
import { getActiveDeploy } from '../../deploy/cmd/utils';

const pretty = flag({
    long: 'pretty',
    description: 'Display contracts with proxy and implementation addresses in a single row'
});

export async function handler(_user: TState, args: {json: boolean |undefined, env: string, pending: boolean, pretty: boolean}): Promise<void> {
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
    } else if (args.pretty) {
        console.log(chalk.bold.underline(`Environment Parameters`))
        
        // Separate contracts from other env variables
        const contractEntries: Record<string, {proxy?: string, impl?: string}> = {};
        const otherEntries: Record<string, string> = {};
        
        const sortedKeys = Object.keys(env).sort();
        
        for (const key of sortedKeys) {
            if (key.startsWith('ZEUS_DEPLOYED_')) {
                const contractName = key.replace('ZEUS_DEPLOYED_', '');
                
                if (contractName.endsWith('_Proxy')) {
                    const baseName = contractName.substring(0, contractName.length - '_Proxy'.length);
                    if (!contractEntries[baseName]) {
                        contractEntries[baseName] = {};
                    }
                    contractEntries[baseName].proxy = env[key];
                } else if (contractName.endsWith('_Impl')) {
                    const baseName = contractName.substring(0, contractName.length - '_Impl'.length);
                    if (!contractEntries[baseName]) {
                        contractEntries[baseName] = {};
                    }
                    contractEntries[baseName].impl = env[key];
                } else {
                    // No proxy/impl suffix, treat as implementation only
                    if (!contractEntries[contractName]) {
                        contractEntries[contractName] = {};
                    }
                    contractEntries[contractName].impl = env[key];
                }
            } else {
                otherEntries[key] = env[key];
            }
        }
        
        // Display contracts
        if (Object.keys(contractEntries).length > 0) {
            console.log(chalk.bold('\nContracts:'));
            const contractTable = Object.entries(contractEntries).map(([name, addresses]) => ({
                contract: name,
                proxy: addresses.proxy || '-',
                implementation: addresses.impl || '-'
            }));
            console.table(contractTable);
        }
        
        // Display other environment variables
        if (Object.keys(otherEntries).length > 0) {
            console.log(chalk.bold('\nEnvironment Variables:'));
            console.table(otherEntries);
        }
    } else {
        console.log(chalk.bold.underline(`Environment Parameters`))

        // highlight any parameters that have changed.
        if (withDeploy) {
            const keys = Object.keys(env).sort();
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
            const sortedKeys = Object.keys(env).sort();
            const sortedEnv = sortedKeys.reduce((acc, key) => {
                acc[key] = env[key];
                return acc;
            }, {} as Record<string, string>);
            console.table(sortedEnv);
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
        pretty,
    },
    handler: requires(handler, withHost),
})

export default cmd;