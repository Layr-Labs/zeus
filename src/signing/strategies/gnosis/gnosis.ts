
import { ICachedArg, Strategy, TStrategyOptions } from "../../strategy";
import * as prompts from '../../../commands/prompts';
import { TDeploy } from "../../../metadata/schema";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TForgeOutput } from "../../utils";

export abstract class GnosisSigningStrategy extends Strategy {
    rpcUrl: ICachedArg<string>
    forMultisig: `0x${string}` | undefined; // automatically set when we ascertain what this signing strategy is for...

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.rpcUrl = this.arg(async () => {
            return await prompts.rpcUrl(deploy._.chainId);
        }, 'rpcUrl');
    }

    async run(_deploy: TDeploy): Promise<boolean> {
        return false;
    }

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute()`, `--rpc-url`, await this.rpcUrl.get(), `-vvvv`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        return await this.forgeArgs();
    }

    filterMultisigRequests(output: TForgeOutput["output"], _multisig: `0x${string}`) {
        return output.traces.filter(trace => {
            return trace[0] === "Execution"
        }).map(
            trace => trace[1].arena.filter(entry => 
                entry.trace.success && 
                entry.trace.kind === "CALL" && 
                entry.trace.data !== "0x61461954" && // initial script call
                entry.trace.address !== "0x7109709ecfa91a80626ff3989d68f67f5b1dd12d" // vm call
            )
        ).flat().map(trace => {
            return {
                to: trace.trace.address,
                value: trace.trace.value,
                data: trace.trace.data,
            }
        });
    }
}