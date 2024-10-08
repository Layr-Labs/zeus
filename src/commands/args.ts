import { flag, option, string, optional } from "cmd-ts";

export const env = option({ type: string, long: 'env', short: 'e' })
export const upgrade = option({ type: string, long: 'upgrade', short: 'u' });
export const signingStrategy = option({ type: string, long: 'signingStrategy', short: 's'})
export const json = flag({
    long: 'json',
    short: 'j',
});

export const rpcUrl = option({ type: optional(string), long: 'rpcUrl', short: 'r'})

// signingStrategy arguments.
export const signingStrategyFlags = {
    privateKey: option({ type: optional(string), long: 'privateKey', short: 'p', defaultValue: () => '' }),
    safeAddress: option({ type: optional(string), long: 'safeAddress', short: 's', defaultValue: () => '' }),
}