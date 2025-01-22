import { flag, option, string, optional, positional } from "cmd-ts";

export const env = option({ type: string, long: 'env', short: 'e', description: "An environment, one returned from `zeus env list`" })
export const versionOptional = option({ type: string, long: 'version', description: "The version to specify."});

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
export const requiredRpcUrl = option({ type: string, long: 'rpcUrl', short: 'r', description: "Provide an RPC url."});

export const signer = option({type: string, long: 'signer', short: 's', description: "An ethereum private key"});

export const nonInteractive = flag({
    long: 'nonInteractive',
    short: 'n',
});

const FORK_DESCRIPTION = `one of: 'anvil', 'tenderly'
    If --fork is specified, the upgrade will be applied against a forked copy of the environment in which the deploy was to be run.
    
    Applies all upgrades onto the forked testnet.
            - Any EOA steps are executed using a random address, that is pre-funded with 420 ETH via cheatcodes.
            - Any multisig steps are executed using a "sendUnsignedTransaction" cheatcode, directly from the Multisig's perspective.
            - Any script phases are skipped.

    '--fork anvil': spins up a local anvil node and applies the upgrade.
        (1) Starts up a local anvil node
        (2) Applies all upgrades onto the anvil node
            - Any EOA steps are executed using a random address, that is pre-funded with 420 ETH via anvil cheatcodes.
            - Any multisig steps are executed using a "sendUnsignedTransaction" anvil cheatcode, directly from the Multisig's perspective.

    '--fork tenderly': spins up a tenderly testnet and applies the upgrade.
        requires the following env vars:
            TENDERLY_API_KEY - an API key, valid for the given account/project.
            TENDERLY_ACCOUNT_SLUG - the account name.
            TENDERLY_PROJECT_SLUG - the project name, in which to create the virtual testnet.
`;  

export const fork = option({
    long: 'fork',
    short: 'f',
    description: FORK_DESCRIPTION,
    type: optional(string)
});