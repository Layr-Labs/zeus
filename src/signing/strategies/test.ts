import { injectableEnvForEnvironment } from "../../commands/run";
import { Transaction } from "../../metadata/metadataStore";
import { runWithArgs } from "../utils";

interface TRunContextWithEnv {
    env: string // in the context of an env.
};

type TRunContextWithDeploy = TRunContextWithEnv & {
    deploy: string; // in the context of an ongoing deploy.
}

type TRunContext = undefined | TRunContextWithDeploy | TRunContextWithEnv;

export const runTest = async (args: {upgradePath: string, txn: Transaction, context: TRunContext}) => {
    const deployContext = (args.context as TRunContextWithDeploy | undefined);
    const env: Record<string, string> = deployContext?.env ? (await injectableEnvForEnvironment(args.txn, deployContext.env)) : {};
    return await runWithArgs('forge', ['script', args.upgradePath, '--sig', `zeusTest()`, `--json`], {...process.env, ...env}, true /* liveOutput */);
}