import {command, option} from 'cmd-ts';
import {json} from './args';
import { assertInRepo, withHost, requires, TState } from './inject';
import { loadExistingEnvs } from './env/cmd/list';
import { execSync } from 'child_process';
import { canonicalPaths } from '../metadata/paths';
import { TDeploy, TDeployedContract, TDeployedContractsManifest, TDeployStateMutations, TEnvironmentManifest, TUpgrade } from '../metadata/schema';
import { TDeployedInstance } from '../metadata/schema';
import * as allArgs from './args';
import { Transaction } from '../metadata/metadataStore';
import { zeus as zeusInfo } from '../metadata/meta';
import { getActiveDeploy } from './deploy/cmd/utils';

const normalize = (str: string) => {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
}

const normalizeContractName = (contractName: string): string => {
    // Remove any .sol ending
    const normalized = contractName.replace(/\.sol$/i, '');

    // Convert any random characters (non-alphanumeric) to '_'
    return normalize(normalized);
};

export const contractsToEnvironmentVariables: (statics: Record<string, TDeployedContract>, instances: TDeployedInstance[]) => Record<string, string> = (statics, instances) => {
    const deployedSingletons = Object.entries(statics).map<[string, `0x${string}`]>(v => {
        const [contract, singleton] = v;
        return [`ZEUS_DEPLOYED_${normalizeContractName(contract)}`, singleton.address]
    }) ?? {};
    const deployedInstances = instances.map(inst => [`ZEUS_DEPLOYED_${normalizeContractName(inst.contract)}_${inst.index}`, inst.address]) ?? {};
    return Object.fromEntries([
        ...deployedSingletons,
        ...deployedInstances
    ])
}

export const deployParametersToEnvironmentVariables: (parameters: Record<string, string> | undefined) => Record<string, string> = (parameters) => {
    if (!parameters) {
        return {};
    }

    return Object.fromEntries(Object.keys(parameters).map(key => {
        if (typeof parameters[key] === 'object') {
            throw new Error(`Unsupported environment type.`);
        }
        return [`ZEUS_ENV_${normalize(key)}`, parameters[key]]
    }))
}

export interface TBaseZeusEnv {
    ZEUS_ENV: string,
    ZEUS_ENV_COMMIT: string,
    ZEUS_ENV_VERSION: string
    ZEUS_VERSION: string

    // information from the zeus upgrade object (from => to)
    ZEUS_DEPLOY_FROM_VERSION: string,
    ZEUS_DEPLOY_TO_VERSION: string,
}

// if `withDeploy` is specified, we also inject instances/statics updated as part of the deploy.
export const injectableEnvForEnvironment: (txn: Transaction, env: string, withDeploy?: string) => Promise<TBaseZeusEnv & Record<string, string>> = async (txn, env, withDeploy) => {
    const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(env));
    if (!envManifest._.id) {
        throw new Error(`No such environment: ${env}`);
    }

    const deployInfo = withDeploy ? (await txn.getJSONFile<TDeploy>(canonicalPaths.deployStatus({env, name: withDeploy})))._ : undefined;
    const upgradeInfo = (withDeploy && deployInfo) ? (await txn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(deployInfo.upgrade))) : undefined;

    const deployManifest: TDeployedContractsManifest = withDeploy ? (await txn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts({env, name: withDeploy})))._ : {contracts: []};
    const deployParameters = await txn.getJSONFile<Record<string, string>>(canonicalPaths.deployParameters(
        '',
        env,
    ));

    const deployedEnvironmentMutations = withDeploy ? ((await txn.getJSONFile<TDeployStateMutations>(canonicalPaths.deployStateMutations({env, name: withDeploy})))._.mutations ?? []) : [];
    const deployEnvUpdates: Record<string, string> = Object.fromEntries(deployedEnvironmentMutations.map(mut => [mut.name, `${mut.next}`]));
    
    const deployStatics = Object.fromEntries(deployManifest.contracts?.filter(c => c.singleton).map(c => [c.contract, c]) ?? [])
    const deployInstances = deployManifest.contracts?.filter(c => !c.singleton) ?? [];
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
        ZEUS_ENV: env,
        ZEUS_ENV_COMMIT: envManifest._.latestDeployedCommit,
        ZEUS_TEST: 'false', /* test environments should override this */
        ZEUS_ENV_VERSION: envManifest._.deployedVersion,

        ZEUS_DEPLOY_FROM_VERSION: upgradeInfo?._.from ?? ``,
        ZEUS_DEPLOY_TO_VERSION: upgradeInfo?._.to ?? ``,

        ZEUS_VERSION: zeusInfo.Version,
        ...(deployParametersToEnvironmentVariables({
            ...(deployParameters._ ?? {}),
            ...deployEnvUpdates,
        })),
        ...(contractsToEnvironmentVariables(statics, instances)),
    }
}

const handler = async function(_user: TState, args: {env: string, pending: boolean, command: string}) {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore?.begin();
    const envs = await loadExistingEnvs(txn);

    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment.`);
        return;
    }

    const withDeploy = args.pending ? await getActiveDeploy(txn, args.env) : undefined;
    const env = await injectableEnvForEnvironment(txn, args.env, withDeploy?._.name);
    execSync(args.command, {stdio: 'inherit', env: {...env, ...process.env}});
};

const cmd = command({
    name: 'run',
    description: 'run a command with all latest deployed contract addresses for a particular environment injected. Follows the format `export DEPLOYED_CONTRACTNAME="0x..."` ',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        pending: allArgs.pending,
        command: option({
            long: 'command',
            short: 'c',
            description: 'A full shell command to run.'
        })
    },
    handler: requires(handler, withHost),
})
export default cmd;