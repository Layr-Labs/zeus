import { isAddress } from 'viem';
import { question, select, privateKey as privateKeyPrompt } from './utils';
import { privateKeyToAccount } from 'viem/accounts';

export const privateKey = async () => {
    const resp = await privateKeyPrompt({text: 'Enter an ETH private key (or $ENV_VAR)', 
    isValid: (text) => {
        try {
            let pk: string | undefined = text;
            if (pk.startsWith("$")) {
                pk = process.env[pk.substring(1)];
            }
            if (!pk!.startsWith('0x')) {
                pk = `0x${pk}`;
            }
            privateKeyToAccount(pk as `0x${string}`);
            return true;
        } catch {
            return false;
        }
    }})
    return resp;
}

export const rpcUrl = async () => {
    const res = await question({text: "Enter an RPC url (or $ENV_VAR)",
        isValid: (text) => {
            try {
                let url: string | undefined = text;
                if (url.startsWith("$")) {
                    url = process.env[url.substring(1)];
                }

                new URL(url!);
                return true;
            } catch {
                return false;
            }
    }})
    if (res.startsWith('$')) {
        return process.env[res.substring(1)];
    }
    return res;
} 

type TStrategyModel = {
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
    const res = await question({text: "Enter the address of your Gnosis Multisig SAFE (or $ENV_VAR)",
        isValid: (text) => isAddress(text) || (text.startsWith('$') && isAddress(process.env[text.substring(1)]!)),
    })
    if (res.startsWith('$')) {
        return process.env[res.substring(1)];
    }
    return res;
} 