import { injectableEnvForEnvironment } from "../../commands/run";
import { Transaction } from "../../metadata/metadataStore";
import { TDeploy } from "../../metadata/schema";
import { runWithArgs } from "../utils";

export const runTest = async (args: {upgradePath: string, txn: Transaction, deploy: TDeploy}) => {
    // TODO: inject environment.

    const env = await injectableEnvForEnvironment(args.txn, args.deploy.env, args.deploy.name)

    // TODO: what are the args for running a test?
    runWithArgs('forge', ['run'], {...process.env, ...env})

    console.log(`Upgrade path`);
}