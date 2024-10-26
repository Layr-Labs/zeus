import { isAddress } from 'viem';
import { select } from './utils';
import { privateKeyToAccount } from 'viem/accounts';
import { search, input, password as inquirerPassword } from '@inquirer/prompts';

const envVarOrPrompt: (args: {
    title: string,
    envVarSearchMessage?: string,
    directEntryInputType: "text" | "password",
    isValid: (text: string) => boolean,
}) => Promise<string> = async (args) => {
    const answer = await select({
        prompt: `Choose method - ${args.title}`,
        choices: [{
            name: 'Enter directly in terminal',
            value: 'enter_directly',
        }, {
            name: 'Use an $ENV_VAR',
            value: 'env_var'
        }]
    });
    if (answer === 'env_var') {
        const envVar = await search<string>({
            message: args.envVarSearchMessage ?? 'Choose an environment variable',
            source: async (input) => {
                return Object.keys(process.env).filter(key => input ? key.startsWith(input) : true) as string[]
            },
            validate: async (input) => {
                try {
                    return args.isValid(process.env[input as string] ?? '');
                } catch {
                    return false;
                }
            }
        })
        return process.env[envVar] ?? '';
    } else {
        switch (args.directEntryInputType) {
            case "password": {
                return await inquirerPassword({
                    message: args.title,
                    validate: args.isValid,
                    mask: '*'
                });
            }
            case "text":
            default: {
                return await input({ message: args.title, validate: args.isValid });
            }
        }
    }
}

export const privateKey = async (chainId: number) => {
    const res = await envVarOrPrompt({
        title: `Enter an ETH private key (${chainIdName(chainId)})`,
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
    return res;
}

const getChainId = async (nodeUrl: string) => {
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
                name: s.id,
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

export const safeAddress = async () => {
    while (true) {
        const result = await envVarOrPrompt({
            title: `Enter the address of your Gnosis Multisig SAFE (or $ENV_VAR)`,
            isValid: (text) =>  isAddress(text),
            directEntryInputType: 'text',
            envVarSearchMessage: 'Enter a multisig address'
        })
        
        // TODO:check that the SAFE is deployed
        return result;
    }
} 