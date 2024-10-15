import { flag, option, string, optional } from "cmd-ts";

export const env = option({ type: string, long: 'env', short: 'e', description: "An environment, one returned from `zeus env list`" })

// usually, you will specify either `--resume` or `--upgrade`.
export const resume = flag({ long: 'resume', description: "Resume an existing running deploy."});
export const upgrade = option({ type: optional(string), long: 'upgrade', short: 'u', description: "The name of an upgrade in your upgrade directory."});

export const json = flag({
    long: 'json',
    short: 'j',
});
export const rpcUrl = option({ type: optional(string), long: 'rpcUrl', short: 'r'})
