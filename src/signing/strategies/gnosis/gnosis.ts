
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

    async forgeArgs(): Promise<string[]> {
        return ['--sig', `execute()`, `--rpc-url`, await this.rpcUrl.get(), `-vvvv`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        return await this.forgeArgs();
    }

    filterMultisigRequests(output: TForgeOutput["output"], _multisig: `0x${string}`) {
        // https://github.com/foundry-rs/foundry/issues/10050 (this should be _multisig_ if forge worked.)
        const DEPLOYED_CONTRACT_ADDRESS = output.traces[0][1].arena[0].trace.address;
        if (!DEPLOYED_CONTRACT_ADDRESS) {
            throw new Error(`Failed to read deployed script address.`);
        }

        return output.traces.filter(trace => {
            return trace[0] === "Execution"
        }).map(
            trace => trace[1].arena.filter(entry => (
                    entry.trace.success && 
                    entry.trace.kind === "CALL" && 
                    entry.trace.data !== "0x61461954" && // initial script call
                    entry.trace.address !== "0x7109709ecfa91a80626ff3989d68f67f5b1dd12d" && // vm call
                    entry.trace.caller.toLowerCase() === DEPLOYED_CONTRACT_ADDRESS.toLowerCase()
                )
            )
        ).flat().map(trace => ({
            from: trace.trace.caller as `0x${string}`,
            to: trace.trace.address as `0x${string}`,
            value: trace.trace.value as `0x${string}`,
            data: trace.trace.data  as `0x${string}`,
        }));
    }
}