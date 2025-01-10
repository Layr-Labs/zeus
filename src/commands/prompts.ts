import { select } from './utils';
import { privateKeyToAccount } from 'viem/accounts';
import { search, input, password as inquirerPassword } from '@inquirer/prompts';
import chalk from 'chalk';
import * as AllChains from "viem/chains";
import { createPublicClient, getContract, http } from 'viem';
import { abi } from "../signing/strategies/gnosis/onchain/Safe";

export const checkShouldSignGnosisMessage = async (message: unknown) => {
    console.log(chalk.bold(`Zeus would like to sign the following EIP-712 message for Gnosis: `))
    console.warn(chalk.bold("========================================================================================================================"))
    console.warn(chalk.bold(`WARNING: Signing and submitting this message constitutes an 'approval' from your wallet. Don't proceed if you aren't ready.`))
    console.warn(chalk.bold("========================================================================================================================"))
    console.log(JSON.stringify(message, null, 2));
    if (!await wouldYouLikeToContinue()) {
        throw new Error(`Transaction not approved. Cancelling for now.`);
    }
}

const cachedAnswers: Record<string, string> = {};

export const envVarOrPrompt: (args: {
    title: string,
    envVarSearchMessage?: string,
    directEntryInputType: "text" | "password",
    isValid: (text: string) => boolean,

    /**
     * Allows answers to be reused, to avoid reprompting.
     */
    reuseKey?: string,
}) => Promise<string> = async (args) => {
    if (args.reuseKey && cachedAnswers[args.reuseKey] !== undefined) {
        return cachedAnswers[args.reuseKey];
    }

    const answer = await select({
        prompt: `[choose method] ${args.title}`,
        choices: [{
            name: 'Use an $ENV_VAR',
            value: 'env_var'
        },{
            name: 'Enter directly in terminal',
            value: 'enter_directly',
        }, ]
    });
    if (answer === 'env_var') {
        const envVar = await search<string>({
            message: args.envVarSearchMessage ?? 'Choose an environment variable',
            source: async (input) => {
                return Object.keys(process.env)
                            .filter(key => input ? key.startsWith(input) : true)
                            .filter(key => args.isValid(process.env[key] ?? '')) as string[]
            },
            validate: async (input) => args.isValid(process.env[input as string] ?? '')
        })
        const resp = process.env[envVar] ?? '';
        if (args.reuseKey) {
            cachedAnswers[args.reuseKey] = resp;
        }
        return resp;
    } else {
        switch (args.directEntryInputType) {
            case "password": {
                if (args.reuseKey) {
                    throw new Error(`Reuse key not supported for passwords.`);
                }

                return await inquirerPassword({
                    message: args.title,
                    validate: args.isValid,
                    mask: '*'
                });
            }
            case "text":
            default: {
                const res = await input({ message: args.title, validate: args.isValid });
                if (args.reuseKey) {
                    cachedAnswers[args.reuseKey] = res;
                }
                return res;
            }
        }
    }
}

export const etherscanApiKey: () => Promise<string | false> = async () => {
    const res = await wouldYouLikeToContinue(`Would you like to verify contracts on etherscan?`);
    if (res) {
        return await envVarOrPrompt({
            title: `Enter an etherscan API key`,
            isValid: (text) => text.length === 34,
            directEntryInputType: 'password',
            envVarSearchMessage: `Enter a 34-character etherscan API key`
        })
    }

    return false;
};

export const privateKey: (chainId: number, overridePrompt?: string) => Promise<`0x${string}`> = async (chainId, overridePrompt?) => {
    const res = await envVarOrPrompt({
        title: `${overridePrompt ?? 'Enter an ETH private key'} (${chainIdName(chainId)})`,
        isValid: (text) => {
            try {
                let pk: string = text;
                if (pk.startsWith("$")) {
                    pk = process.env[pk.substring(1)] ?? '';
                }
                if (!pk.startsWith('0x')) {
                    pk = `0x${pk}`;
                }
                privateKeyToAccount(pk as `0x${string}`);
                return true;
            } catch {
                return false;
            }
        },
        directEntryInputType: 'password',
        envVarSearchMessage: 'Choose an environment variable with an ETH private key'
    })
    if (!res.startsWith('0x')) {
        return `0x${res}`;
    }
    return res as `0x${string}`;
}

export const accountIndex = async () => {
    const cont = await wouldYouLikeToContinue("Would you like to use a custom bip39 account index? (NOTE: the default 'm/44'/60'/0'/0/[0]s' will be used otherwise)");
    if (!cont) {
        return 0;
    }

    const val = await envVarOrPrompt({
        title: `Enter the derivation path suffix (e.g m/44'/60'/0'/0/[0]) - (default: 0)`,
        directEntryInputType: 'text',
        isValid: (val: string) => {
            try {
                parseInt(val);
                return true;
            } catch {
                return false;
            }
        }
    })

    return parseInt(val);
}

export const signerKey = async (chainId: number, rpcUrl: string, overridePrompt: string | undefined, safeAddress: `0x${string}`) => {
    let attempt = 0;
    const publicClient = createPublicClient({
        chain: Object.values(AllChains as unknown as AllChains.Chain<undefined>[]).find(chain => chain.id === chainId),
        transport: http(rpcUrl)
    })
    const safe = getContract({client: publicClient, abi, address: safeAddress});

    while (attempt++ < 3) {        
        const pk = await privateKey(chainId, overridePrompt);
        const providedAddress = privateKeyToAccount(pk).address;
        if (!await safe.read.isOwner([providedAddress])) {
            console.error(`Warning: The provided privateKey is for ${providedAddress}, which is not an owner of Safe(${safeAddress}, chainId=${chainId})`)
            console.error(`Please choose another key.`);
            continue;
        } else {
            return pk;
        }
    }
    
    throw new Error(`Failed to provide a signer.`);
}

export const getChainId = async (nodeUrl: string) => {
    try {
        const response = await fetch(nodeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_chainId",
                params: [],
                id: 1
            }),
        });

        const data = await response.json();
        const chainIdHex = data.result;
        // Convert the hexadecimal chain ID to a decimal number
        const chainId = parseInt(chainIdHex, 16);

        return chainId;
    } catch (error) {
        console.error("Error fetching chain ID:", error);
        throw error;
    }
}

export const chainIdName = (chainId: number) => {
    switch (chainId) {
        case 1:
            return 'Mainnet'
        case 17000:
            return 'Holesky'
        case 11155111:
            return 'Sepolia';
        default:
            return `chains/${chainId}`;
    }
};

export const rpcUrl = async (forChainId: number) => {
    while (true) {
        const result = await envVarOrPrompt({
            title: `Enter an RPC url (or $ENV_VAR) for ${chainIdName(forChainId)}`,
            reuseKey: `node-${forChainId}`,
            isValid: (text) => {
                try {
                    let url: string = text;
                    if (url.startsWith("$")) {
                        url = process.env[url.substring(1)] ?? '';
                    }

                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            },
            directEntryInputType: 'text',
            envVarSearchMessage: 'Enter a node url'
        })
        
        const chainId = await getChainId(result);
        if (chainId !== forChainId) {
            console.error(`This node is for an incorrect network (expected chainId=${chainIdName(forChainId)}, got ${chainIdName(chainId)})`);
            continue;
        }
        return result;
    }
} 

interface TStrategyModel {
    id: string,
    description: string
}

export const pickStrategy = async (strategies: TStrategyModel[], overridePrompt?: string) => {
    const id = await select({
        prompt: overridePrompt ?? "How would you like to perform this upgrade?",
        choices: strategies.map(s => {
            return {
                name: s.description,
                value: s.id,
                description: s.description,
            }
        })
    });
    return id;
}

export const wouldYouLikeToContinue = async (overridePrompt?: string) : Promise<boolean> => {
    const res = await select({
        prompt: overridePrompt ?? "Would you like to continue?",
        choices: [{
            name: 'yes',
            value: 'yes',
        }, {
            name: 'no',
            value: 'no'
        }]
    });
    return res === 'yes';
}

export const pressAnyButtonToContinue = async (overridePrompt?: string) : Promise<void> => {
    await select({
        prompt: overridePrompt ?? "Press any button to continue.",
        choices: [{
            name: 'yes',
            value: 'yes',
        }]
    });
}