import {command, number, option, positional, string} from 'cmd-ts';
import {json} from './args';
import { assertInRepo, withHost, requires, TState } from './inject';
import * as allArgs from './args';
import { TDeployedContract, TEnvironmentManifest } from '../metadata/schema';
import { canonicalPaths } from '../metadata/paths';
import { Transaction } from '../metadata/metadataStore';
import { loadExistingEnvs } from './env/cmd/list';
import { isAddress } from 'viem';

const findContract: ((env: string, contractName: string, instance: number | undefined, txn: Transaction) => Promise<TDeployedContract | undefined>) = async (env, contractName, instance, txn) => {
    const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(env));
    try {
        return (envManifest._.contracts.static ?? {})[contractName] ?? (envManifest._.contracts.instances.filter(inst => inst.contract === contractName)[instance ?? 0])
    } catch {
        return;
    }
}

const handler = async function(_user: TState, args: {contractOrAddress: string, env: string | undefined, instance: number}) {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin();

    if (isAddress(args.contractOrAddress)) {
        const envs = await loadExistingEnvs(txn);
        const manifests = await Promise.all(envs.map(async env => {
            return await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(env.name));
        }))
        const deployParameters = await Promise.all(envs.map(async env => {
            return await txn.getJSONFile<Record<string, unknown>>(canonicalPaths.deployParameters('', env.name));
        }));

        // Record<environment name, symbol>
        const hits: [string, string][] = [];
        manifests.forEach((manifest, i) => {
            if (manifest._.contracts) {
                const instanceCounter: Record<string, number> = {};
                manifest._.contracts.instances?.forEach(instance => {
                    const whichInstance = instanceCounter[instance.contract] ?? 0;
                    if (instance.address.toLowerCase() == args.contractOrAddress.toLowerCase()) {
                        hits.push([manifest._.id, `${instance.contract}_${whichInstance}`]);
                    }
                    instanceCounter[instance.contract] = whichInstance + 1;
                });
                Object.keys(manifest._.contracts.static ?? {}).forEach(name => {
                    const contr = manifest._.contracts.static[name];
                    if (contr.address.toLowerCase() == args.contractOrAddress.toLowerCase()) {
                        hits.push([manifest._.id, name]);
                    }
                });
            }

            const params = deployParameters[i]._;
            Object.entries(params).forEach(([key, value]) => {
                if (`${value}`.toLowerCase() === args.contractOrAddress.toLowerCase()) {
                    hits.push([manifest._.id, key]);
                }
            });
        })

        if (Object.keys(hits).length > 0) {
            console.table(hits);
        } else {
            console.error(`<no matches>`);
        }
        return;
    }
    
    if (args.env) {
        const contract = await findContract(args.env, args.contractOrAddress, args.instance, txn);
        if (!contract) {
            throw new Error(`No such contract '${args.contractOrAddress}' in ${args.env}`);
        }
        console.log(JSON.stringify(contract));
    } else {
        // load it in every environment...
        const envs = await loadExistingEnvs(txn);
        const data = (await Promise.allSettled(envs.map(async env => {
            const deployedContract = await findContract(env.name, args.contractOrAddress, args.instance, txn);
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
    description: 'Search for a contract address or contract name in an environment.`',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.envOptional,
        contractOrAddress: positional({
            type: string
        }),
        instance: option({
            long: 'instance',
            short: 'i',
            type: number,
            defaultValue: () => 0
        })
    },
    handler: requires(handler, withHost),
})
export default cmd;