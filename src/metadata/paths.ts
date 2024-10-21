import {join} from 'path';

export const canonicalPaths = {
    // root deploys directory for a given env
    allDeploysDirectory: (repoRoot: string, env: string) => join(repoRoot, "deploys", env),

    // specific directory for a given deploy.
    deployDirectory: (repoRoot: string, env: string, deployName: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), deployName),

    deployStatus: (args: {env: string, name: string}) => join(
        canonicalPaths.deployDirectory('', args.env, args.name),
        "deploy.json"
    ),

    // parameters.json
    deployParameters: (repoRoot: string, env: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), "parameters.json"),

    // updated immediately after a forge script execution.
    forgeDeployLatestMetadata: (repoRoot: string, scriptName: string, chainId: number) =>       join(repoRoot, `broadcast`, scriptName, `${chainId}`, `deploy-latest.json`),
    
    // timestamp comes from the JSON output of the DeployLatestMetadata.
    forgeRunJson: (repoRoot: string, scriptName: string, chainId: number, timestamp: number) => join(repoRoot, `broadcast`, scriptName, `${chainId}`, `run-${timestamp}.json`),

    environmentManifest: (envName: string) => `environment/${envName}/manifest.json`,
    deploysManifest: (envName: string) => `environment/${envName}/deploys/deploys.json`,

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
    foundryRun: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "foundry.run.json"
    ),
    foundryDeploy: (args: {deployEnv: string, deployName: string, segmentId: number}) => join(
        canonicalPaths.deployDirectory("", args.deployEnv, args.deployName),
        `${args.segmentId}`,
        "foundry.deploy.json"
    )
}
