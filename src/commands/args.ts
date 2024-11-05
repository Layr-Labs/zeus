import { flag, option, string, optional, positional } from "cmd-ts";

export const env = option({ type: string, long: 'env', short: 'e', description: "An environment, one returned from `zeus env list`" })
export const envOptional = option({ type: optional(string), long: 'env', short: 'e', description: "An environment, one returned from `zeus env list`" })
export const envPositional = positional({ type: string, description: "An environment, one returned from `zeus env list`" })

export const verbose = flag({ long: 'verbose', short: 'v', description: "Provide as much descriptive output as possible."});

// usually, you will specify either `--resume` or `--upgrade`.
export const resume = flag({ long: 'resume', description: "Resume an existing running deploy."});
export const upgrade = option({ type: optional(string), long: 'upgrade', short: 'u', description: "The name of an upgrade in your upgrade directory."});

export const json = flag({
    long: 'json',
    short: 'j',
});
export const rpcUrl = option({ type: optional(string), long: 'rpcUrl', short: 'r'})
