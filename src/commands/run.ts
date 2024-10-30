import {command, option} from 'cmd-ts';
import {json} from './args';
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from './inject';
import { loadExistingEnvs } from './env/cmd/list';
import { execSync } from 'child_process';
import { canonicalPaths } from '../metadata/paths';
import { TDeployedContract, TDeployedContractsManifest, TEnvironmentManifest } from '../metadata/schema';
import { TDeployedInstance } from '../metadata/schema';
import * as allArgs from './args';
import { Transaction } from '../metadata/metadataStore';
import { zeus as zeusInfo } from '../metadata/meta';

const normalizeContractName = (contractName: string): string => {
    // Remove any .sol ending
    const normalized = contractName.replace(/\.sol$/i, '');

    // Convert any random characters (non-alphanumeric) to '_'
    return normalized.replace(/[^a-zA-Z0-9]/g, '_');
};

export const contractsToEnvironmentVariables: (statics: TDeployedContract[], instances: TDeployedInstance[]) => Record<string, string> = (statics, instances) => {
    const deployedSingletons = Object.values(statics).map(singleton => [`ZEUS_DEPLOYED_${normalizeContractName(singleton.contract)}`, singleton.address]) ?? {};
    const deployedInstances = instances.map(inst => [`ZEUS_DEPLOYED_${normalizeContractName(inst.contract)}_${inst.index}`, inst.address]) ?? {};
    return Object.fromEntries([
        ...deployedSingletons,
        ...deployedInstances
    ])
}

// if `withDeploy` is specified, we also inject instances/statics updated as part of the deploy.
export const injectableEnvForEnvironment = async (txn: Transaction, env: string, withDeploy?: string) => {
    const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(env));
    const deployManifest: TDeployedContractsManifest = withDeploy ? (await txn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts({env, name: withDeploy})))._ : {contracts: []};

    const deployStatics = Object.fromEntries(deployManifest.contracts.filter(c => c.singleton).map(c => [c.contract, c]))
    const deployInstances = deployManifest.contracts.filter(c => !c.singleton);

    const statics = {
        ...(envManifest._.contracts?.static ?? {}),
        ...(deployStatics ?? {})
    };

    // group by `cur.contract`    
    const allInstances = [...(envManifest._.contracts?.instances ?? []), ...(deployInstances )]
    const instancesByContract = allInstances.reduce((accum, cur) => {
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

    return {
        ...(contractsToEnvironmentVariables(Object.values(statics), instances)),
        ZEUS_VERSION: zeusInfo.Version,
        ZEUS_ENV: env,
        ZEUS_ENV_COMMIT: envManifest._.latestDeployedCommit,
        ZEUS_ENV_VERSION: envManifest._.deployedVersion,
    }
}

const handler = async function(_user: TState, args: {env: string, command: string}) {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore?.begin();
    const envs = await loadExistingEnvs(txn);

    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment.`);
        return;
    }
    const env = await injectableEnvForEnvironment(txn, args.env);
    execSync(args.command, {stdio: 'inherit', env: {...env, ...process.env}});
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