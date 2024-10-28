import {command, option} from 'cmd-ts';
import {json} from './args';
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from './inject';
import { loadExistingEnvs } from './env/cmd/list';
import { execSync } from 'child_process';
import { canonicalPaths } from '../metadata/paths';
import { TDeployedContract, TEnvironmentManifest } from '../metadata/schema';
import { TDeployedInstance } from '../metadata/schema';
import * as allArgs from './args';

const normalizeContractName = (contractName: string): string => {
    // Remove any .sol ending
    let normalized = contractName.replace(/\.sol$/i, '');

    // Convert any random characters (non-alphanumeric) to '_'
    normalized = normalized.replace(/[^a-zA-Z0-9]/g, '_');

    // Uppercase all characters
    return normalized.toUpperCase();
};

const handler = async function(_user: TState, args: {env: string, command: string}) {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore?.begin();
    const envs = await loadExistingEnvs(txn);

    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment.`);
        return;
    }
    const deployedContracts = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    const statics = deployedContracts._.contracts?.static ?? {};

    const instancesByContract = deployedContracts._.contracts?.instances.reduce((accum, cur) => {
        // group by `cur.contract`
        if (!cur.singleton) {
            accum[cur.contract] = [...(accum[cur.contract] || []), cur];
        }
        return accum;
    }, {} as Record<string, TDeployedContract[]>) ?? {};
    const _instances: TDeployedInstance[][] = Object.keys(instancesByContract).map(contract => instancesByContract[contract].map<TDeployedInstance>((inst, index) => {return {index, ...inst}}))
    const instances = _instances.reduce((accum, cur) => {
        accum = [...accum, ...cur];
        return accum;
    }, [] as TDeployedInstance[])


    const deployedSingletons = Object.values(statics).map(singleton => [`DEPLOYED_${normalizeContractName(singleton.contract)}`, singleton.address]) ?? {};
    const deployedInstances = instances.map(inst => [`DEPLOYED_${normalizeContractName(inst.contract)}_${inst.index}`, inst.address]) ?? {};

    const contracts = Object.fromEntries([
        ...deployedSingletons,
        ...deployedInstances,
    ])
    execSync(args.command, {stdio: 'inherit', env: {...contracts, ZEUS_ENV: args.env, ZEUS_ENV_COMMIT: deployedContracts._.latestDeployedCommit, ZEUS_ENV_VERSION: deployedContracts._.deployedVersion, ...process.env}});
};

const cmd = command({
    name: 'run',
    description: 'run a command with all latest deployed contract addresses for a particular environment injected. Follows the format `export DEPLOYED_CONTRACTNAME="0x..."` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        command: option({
            long: 'command',
            short: 'c',
            description: 'A full shell command to run.'
        })
    },
    // TODO: does this really require being logged in????
    // we likely need a logged out read-only metadataStore as well.
    handler: requires(handler, inRepo, loggedIn),
})
export default cmd;