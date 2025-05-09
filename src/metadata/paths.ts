import {join} from 'path';
import { TDeploy } from './schema';
import { getRepoRoot } from '../commands/configs';

export const canonicalPaths = {
    // root deploys directory for a given env
    allDeploysDirectory: (repoRoot: string, env: string) => join(repoRoot, "deploys", env),

    // specific directory for a given deploy.
    deployDirectory: (repoRoot: string, env: string, deployName: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), deployName),

    deployStatus: (args: {env: string, name: string}) => join(
        canonicalPaths.deployDirectory('', args.env, args.name),
        "deploy.json"
    ),

    scriptLocation: (deploy: TDeploy, segment: number) => join(getRepoRoot(), deploy.upgradePath, deploy.segments[segment].filename),

    currentScriptLocation: (deploy: TDeploy) => join(getRepoRoot(), deploy.upgradePath, deploy.segments[deploy.segmentId].filename),

    deployDeployedContracts: (args: {env: string, name: string}) => join(
        canonicalPaths.deployDirectory('', args.env, args.name),
        "deployed-contracts.json"
    ),
    deployStateMutations: (args: {env: string, name: string}) => join(
        canonicalPaths.deployDirectory('', args.env, args.name),
        "mutations.json"
    ),

    deployLock: (args: {env: string}) => `environment/${args.env}/lock.json`,

    // parameters.json
    deployParameters: (repoRoot: string, env: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), "parameters.json"),

    // the json-schema of the deploy parameters to enforce.
    deployParametersSchema: (repoRoot: string) => join(repoRoot, 'parameters.schema.json'),

    // updated immediately after a forge script execution.
    forgeDeployLatestMetadata: (repoRoot: string, scriptName: string, chainId: number, functionName: string) =>       join(repoRoot, `broadcast`, scriptName, `${chainId}`, `${functionName}-latest.json`),

    contractJson: (repoRoot: string, contractName: string) => join(repoRoot, `out`, `${contractName}.sol`, `${contractName}.json`),

    // timestamp comes from the JSON output of the DeployLatestMetadata.
    forgeRunJson: (repoRoot: string, scriptName: string, chainId: number, timestamp: number) => join(repoRoot, `broadcast`, scriptName, `${chainId}`, `run-${timestamp}.json`),

    environmentManifest: (envName: string) => `environment/${envName}/manifest.json`,
    deploysManifest: (envName: string) => `environment/${envName}/deploys/deploys.json`,

    // record a script run after it's happened
    scriptRun: (args: {deployEnv: string, deployName: string, segmentId: number}) => {
        return join(
            canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
            `${args.segmentId}`,
            `run.json`
        );
    },

    contractInformation: (repoRoot: string, contractName: string) => join(repoRoot, `out`, `${contractName}.sol`, `${contractName}.json`),

    allUpgrades: () => `upgrade`,
    upgradeManifest: (upgradeName: string) => `upgrade/${upgradeName}/manifest.json`,

    multisigRun: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "multisig.run.json"
    ),
    multisigTransaction: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "multisig.transaction.json"
    ),
    testRun: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "test-run.json"
    ),
    foundryRun: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "foundry.run.json"
    ),
    foundryDeploy: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "foundry.deploy.json"
    ),
    segmentContractAbi: (args: {name: string, segmentId: number, env: string, contractName: string}) => join(
        canonicalPaths.deployDirectory("", args.env, args.name),
        `${args.segmentId}`,
        `${args.contractName}.abi.json`
    )
}
