
import { ICachedArg, Strategy } from "../../strategy";
import * as prompts from '../../../commands/prompts';
import { TDeploy } from "../../../metadata/schema";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TForgeOutput } from "../../utils";

export abstract class GnosisSigningStrategy extends Strategy {
    rpcUrl: ICachedArg<string>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, defaultArgs?: Record<string, unknown>) {
        super(deploy, transaction, defaultArgs);
        this.rpcUrl = this.arg(async () => {
            return await prompts.rpcUrl(this.deploy._.chainId);
        });
    } 

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute()`, `--rpc-url`, await this.rpcUrl.get(), `-vvvv`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        return await this.forgeArgs();
    }

    filterMultisigRequests(output: TForgeOutput["output"], multisig: `0x${string}`) {
        return output.traces.filter(trace => {
            return trace[0] === "Execution"
        }).map(
            trace => trace[1].arena.filter(entry => 
                entry.trace.success && 
                entry.trace.address === multisig &&
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