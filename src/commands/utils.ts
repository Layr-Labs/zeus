
import { select as inquirerSelect, Separator, input, password as inquirerPassword } from '@inquirer/prompts';


interface Choice<T> {
    name: string;
    value: T;
    description?: string;
}

export const select = async <T>(args: {
    prompt: string,
    choices: (Choice<T> | Separator)[]
}) => {
  return await inquirerSelect({
    message: args.prompt,
    choices: args.choices,
  });
}

export const password = async (args: {
    text: string, 
    isValid: (text: string) => boolean
}) => {
    return await inquirerPassword({
        message: args.text,
        validate: args.isValid,
    });
};

export const privateKey = async (args: {
    text: string, 
    isValid: (text: string) => boolean
}) => {
    const res = await inquirerPassword({
        message: args.text,
        validate: args.isValid,
        mask: '*'
    });
    if (res.startsWith('$')) {
        return process.env[res.substring(1)];
    }
    if (!res.startsWith('0x')) {
        return `0x${res}`;
    }
    return res;
};

export const question = async (args: {
    text: string, 
    isValid: (text: string) => boolean
}) => {
    return await input({ message: args.text, validate: args.isValid });
};