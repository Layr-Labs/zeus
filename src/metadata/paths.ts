import {join} from 'path';

export const canonicalPaths = {
    deploy: (upgradeDir: string) => join(upgradeDir, "1-deploy.s.sol"),
    queue: (upgradeDir: string) => join(upgradeDir, "2-queue.s.sol"),
    execute: (upgradeDir: string) => join(upgradeDir, "3-execute.s.sol"),

    // root deploys directory for a given env
    allDeploysDirectory: (repoRoot: string, env: string) => join(repoRoot, "deploys", env),

    // specific directory for a given deploy.
    deployDirectory: (repoRoot: string, env: string, deployName: string) => join(canonicalPaths.allDeploysDirectory(repoRoot, env), "deploys", deployName),
}
