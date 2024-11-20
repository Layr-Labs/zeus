import chalk from "chalk";
import { injectableEnvForEnvironment } from "../../commands/run";
import { Transaction } from "../../metadata/metadataStore";
import { parseForgeTestOutput, runWithArgs } from "../utils";

interface TRunContextWithEnv {
    env: string // in the context of an env.
};

type TRunContextWithDeploy = TRunContextWithEnv & {
    deploy: string; // in the context of an ongoing deploy.
}

type TRunContext = undefined | TRunContextWithDeploy | TRunContextWithEnv;

export const runTest = async (args: {upgradePath: string, txn: Transaction, context: TRunContext, verbose: boolean, json: boolean}) => {
    const deployContext = (args.context as TRunContextWithDeploy | undefined);
    const env: Record<string, string> = deployContext?.env ? (await injectableEnvForEnvironment(args.txn, deployContext.env)) : {};
    if (args.verbose) {
        console.log(chalk.underline.bold(`Injecting environment: `));
        console.table(env);
    }
    const jsonArgs = args.json ? ['--json'] : [];
    const cmdArgs = ['test', args.upgradePath, ...jsonArgs, `-vvvv`];
    console.log(`Running command: forge ${cmdArgs.join(' ')}`);

    const {code, stdout, stderr} = await runWithArgs('forge', cmdArgs, {...process.env, ...env}, args.verbose /* liveOutput */);
    return {
        forge: args.json ? parseForgeTestOutput(stdout) : undefined,
        code,
        stdout,
        stderr
    }
}