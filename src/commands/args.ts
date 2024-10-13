import { flag, option, string, optional } from "cmd-ts";
import { all } from "../signing/strategies/strategies";
import { MetadataStore } from "../metadata/metadataStore";
import { TDeploy } from "../metadata/schema.js";

export const env = option({ type: string, long: 'env', short: 'e', description: "An environment, one returned from `zeus env list`" })

// usually, you will specify either `--resume` or `--upgrade`.
export const resume = flag({ long: 'resume', description: "Resume an existing running deploy."});
export const upgrade = option({ type: optional(string), long: 'upgrade', short: 'u', description: "The name of an upgrade in your upgrade directory."});

export const signingStrategy = option({ 
    description: `How you want to sign/execute the upgrade step. Available options: ${all.map(s => new s({} as unknown as TDeploy, {}, undefined as unknown as MetadataStore).id).join(', ')}`, 
    type: optional(string), 
    long: 'signingStrategy', 
    short: 's'
})
export const json = flag({
    long: 'json',
    short: 'j',
});
export const rpcUrl = option({ type: optional(string), long: 'rpcUrl', short: 'r'})

// signingStrategy arguments.
export const signingStrategyFlags = {
    privateKey: option({ type: optional(string), long: 'privateKey', description: "An ETH private key, if using a signing strategy which requires it.", short: 'p', defaultValue: () => '' }),
    safeAddress: option({ type: optional(string), long: 'safeAddress', description: "The address of a Gnosis Safe, if using a signing strategy which requires it.", short: 's', defaultValue: () => '' }),
}