import chalk from "chalk";
import { injectableEnvForEnvironment } from "../../commands/run";
import { Transaction } from "../../metadata/metadataStore";
import { parseForgeTestOutput, runWithArgs, runWithArgsLive } from "../utils";
import * as allChains from 'viem/chains';
import { canonicalPaths } from "../../metadata/paths";
import { TEnvironmentManifest } from "../../metadata/schema";
import { Chain } from 'viem';
import { getChainId } from "../../commands/prompts";
import { dirname, join, resolve } from "path";
import { readdirSync, readFileSync } from "fs";
import { getRepoRoot } from "../../commands/configs";
import { TUpgrade } from "../../metadata/schema";


interface TRunContextWithDeploy {
    deploy: string | undefined; // in the context of an ongoing deploy.
}
type TRunContext = undefined | TRunContextWithDeploy;

const closestUpgradeJson: (upgradePath: string) => TUpgrade = (upgradePath: string) => {
    const fullScriptPath = join(process.cwd(), upgradePath);

    let searchPath = join(process.cwd(), dirname(upgradePath));
    const repoRoot = getRepoRoot();

    while (searchPath.includes(repoRoot)) {
        const files = readdirSync(searchPath);
        if (files.includes('upgrade.json')) {
            const upgradeJsonPath = join(searchPath, 'upgrade.json');
            try {
                const contents = JSON.parse(readFileSync(upgradeJsonPath, {encoding: 'utf-8'})) as TUpgrade;
                // confirm that `phases` contains this file.
                
                const matchingScript = contents.phases.filter(
                    phase => join(dirname(upgradeJsonPath), phase.filename) === fullScriptPath
                )
                if (matchingScript.length === 0) {
                    throw new Error(`The closest upgrade.json didn't include ${upgradePath}. Please check the 'phases' property of your upgrade.`);
                }

                return contents;
            } catch (e) {
                console.error(chalk.yellow(`failed to parse upgrade.json (${upgradeJsonPath})`));
                throw e;
            }
        }

        // check the current directory for upgrade.json
        // see if the upgrade.json lists this file.
        searchPath = resolve(join(searchPath, '..'));
    }

    throw new Error(`failed to locate upgrade.json relative to ${upgradePath}`);
}

export const runTest = async (args: {env: string, upgradePath: string, withDeploy?: string | undefined, rpcUrl?: string | undefined, txn: Transaction, context: TRunContext, verbose: boolean, json: boolean, rawOutput?: boolean}) => {
    const _env: Record<string, string> = await injectableEnvForEnvironment(args.txn, args.env, args.withDeploy);
    const envConfig = await args.txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));

    const upgradeJson = closestUpgradeJson(args.upgradePath);
    const impliedFrom = envConfig._.deployedVersion;
    const impliedTo = upgradeJson.to; // TODO: load the `upgrade.json` that is closest to `upgradePath`. Fail if you reach the repo root without finding one.
    
    const env = {
        ZEUS_DEPLOY_FROM_VERSION: impliedFrom,
        ZEUS_DEPLOY_TO_VERSION: impliedTo,
        ..._env, // NOTE: this is placed here on purpose, s.t if `_env` injects a more accurate `DEPLOY_TO_VERSION` it takes precedence.
        ZEUS_TEST: 'true'
    };

    if (args.rpcUrl) {
        // check that the rpc url chainId matches
        const envObj = await args.txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
        const chainId = await getChainId(args.rpcUrl);
        if (chainId !== envObj._.chainId) {
            throw new Error(`The provided RPC did not correspond to ChainID ${chainId}`);
        }
    }

    const additionalArgs = [];
    const envObj = await args.txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    const chain = Object.values((allChains as unknown as Chain<undefined>[])).find(chain => chain.id === envObj._.chainId)
    const rpcUrl = args.rpcUrl ?? (chain?.rpcUrls ? Object.values(chain.rpcUrls)[0].http[0] : undefined);
    if (rpcUrl) {
        additionalArgs.push(...['--rpc-url', rpcUrl])
    }

    if (args.verbose) {
        console.log(chalk.underline.bold(`Injecting environment: `));
        console.table(env);
    }

    const jsonArgs = args.json ? ['--json'] : [];
    const cmdArgs = ['test', args.upgradePath, ...jsonArgs, ...additionalArgs, '--no-match-path', 'override-empty-path',  `-vvvv`];
    console.log(chalk.italic.white(`Running command: forge ${cmdArgs.join(' ')}`));

    if (args.rawOutput) {
        const {code} = await runWithArgsLive(`forge`, cmdArgs, {...process.env, ...env});
        return {
            forge: undefined,
            code,
            stdout: '',
            stderr: ''
        };
    }

    const {code, stdout, stderr} = await runWithArgs('forge', cmdArgs, {...process.env, ...env}, args.verbose /* liveOutput */);
    return {
        forge: args.json ? parseForgeTestOutput(stdout) : undefined,
        code,
        stdout,
        stderr
    }
}