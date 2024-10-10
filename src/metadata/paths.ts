import {join} from 'path';

export const canonicalPaths = {
    deploy: (upgradeDir: string) => join(upgradeDir, "1-deploy.s.sol"),
    queue: (upgradeDir: string) => join(upgradeDir, "2-queue.s.sol"),
    execute: (upgradeDir: string) => join(upgradeDir, "3-execute.s.sol"),

    // root deploys directory for a given env
    allDeploysDirectory: (repoRoot: string, env: string) => join(repoRoot, "deploys", env),

    // specific directory for a given deploy.
    deployDirectory: (repoRoot: string, env: string, deployName: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), deployName),

    // parameters.json
    deployParameters: (repoRoot: string, env: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), "parameters.json"),

    // updated immediately after a forge script execution.
    forgeDeployLatestMetadata: (repoRoot: string, scriptName: string, chainId: number) =>       join(repoRoot, `broadcast`, scriptName, `${chainId}`, `deploy-latest.json`),
    
    // timestamp comes from the JSON output of the DeployLatestMetadata.
    forgeRunJson: (repoRoot: string, scriptName: string, chainId: number, timestamp: number) => join(repoRoot, `broadcast`, scriptName, `${chainId}`, `run-${timestamp}.json`),

    environmentManifest: (envName: string) => `environment/${envName}/manifest.json`,
    deploysManifest: (envName: string) => `environment/${envName}/deploys/deploys.json`,
    ugradesManifest: (envName: string) => `environment/${envName}/upgrades/upgrades.json`,
}
