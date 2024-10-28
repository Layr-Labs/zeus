import {command, number, option, positional, string} from 'cmd-ts';
import {json} from './args';
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from './inject';
import * as allArgs from './args';
import { TDeployedContract, TEnvironmentManifest } from '../metadata/schema';
import { canonicalPaths } from '../metadata/paths';
import { Transaction } from '../metadata/metadataStore';

export const loadExistingEnvs = async (txn: Transaction) => {
    const environments = await txn.getDirectory('environment');
    return environments.filter(e => e.type === 'dir');
};

const findContract: ((env: string, contractName: string, instance: number | undefined, txn: Transaction) => Promise<TDeployedContract | undefined>) = async (env, contractName, instance, txn) => {
    const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(env));
    try {
        return (envManifest._.contracts.static ?? {})[contractName] ?? (envManifest._.contracts.instances.filter(inst => inst.contract === contractName)[instance ?? 0])
    } catch {
        return;
    }
}

const handler = async function(_user: TState, args: {contract: string, env: string | undefined, instance: number}) {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore.begin();
    
    if (args.env) {
        const contract = await findContract(args.env, args.contract, args.instance, txn);
        if (!contract) {
            throw new Error(`No such contract '${args.contract}' in ${args.env}`);
        }
        console.log(JSON.stringify(contract));
    } else {
        // load it in every environment...
        const envs = await loadExistingEnvs(txn);
        const data = (await Promise.allSettled(envs.map(async env => {
            const deployedContract = await findContract(env.name, args.contract, args.instance, txn);
            return {
                environment: env.name,
                address: deployedContract?.address ?? '<not deployed>',
                "bytecode hash": deployedContract?.deployedBytecodeHash ?? '?'
            }
        }))).map(res => {
            switch (res.status) {
                case 'fulfilled':
                    return res.value;
                case 'rejected':
                    return { name: '<failed>', address: '?', checksum: '?'}
            }
        })
        console.table(data);
    }
};

const cmd = command({
    name: 'which',
    description: 'See a contract address on an environment (or all contract addresses!)` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.envOptional,
        contract: positional({
            type: string
        }),
        instance: option({
            long: 'instance',
            short: 'i',
            type: number,
            defaultValue: () => 0
        })
    },
    handler: requires(handler, loggedIn, inRepo),
})
export default cmd;