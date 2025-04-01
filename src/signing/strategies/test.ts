import chalk from "chalk";
import { injectableEnvForEnvironment } from "../../commands/run";
import { Transaction } from "../../metadata/metadataStore";
import { parseForgeTestOutput, runWithArgs, runWithArgsLive } from "../utils";
import * as allChains from 'viem/chains';
import { canonicalPaths } from "../../metadata/paths";
import { TEnvironmentManifest } from "../../metadata/schema";
import { Chain } from 'viem';
import { getChainId } from "../../commands/prompts";

interface TRunContextWithEnv {
    env: string // in the context of an env.
};

type TRunContextWithDeploy = TRunContextWithEnv & {
    deploy: string; // in the context of an ongoing deploy.
}

type TRunContext = undefined | TRunContextWithDeploy | TRunContextWithEnv;

export const runTest = async (args: {upgradePath: string, withDeploy?: string | undefined, rpcUrl?: string | undefined, txn: Transaction, context: TRunContext, verbose: boolean, json: boolean, rawOutput?: boolean}) => {
    const deployContext = (args.context as TRunContextWithDeploy | undefined);
    const _env: Record<string, string> = deployContext?.env ? (await injectableEnvForEnvironment(args.txn, deployContext.env, args.withDeploy)) : {};
    const env = {
        ..._env,
        ZEUS_TEST: 'true'
    };

    if (args.rpcUrl && deployContext?.env) {
        // check that the rpc url 
        const envObj = await args.txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deployContext.env));
        const chainId = await getChainId(args.rpcUrl);
        if (chainId !== envObj._.chainId) {
            throw new Error(`The provided RPC did not correspond to ChainID ${chainId}`);
        }
    }

    const additionalArgs = [];
    if (deployContext?.env) {
        const envObj = await args.txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deployContext.env));
        const chain = Object.values((allChains as unknown as Chain<undefined>[])).find(chain => chain.id === envObj._.chainId)
        const rpcUrl = args.rpcUrl ?? (chain?.rpcUrls ? Object.values(chain.rpcUrls)[0].http[0] : undefined);
        if (rpcUrl) {
            additionalArgs.push(...['--rpc-url', rpcUrl])
        }
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