
import { select as inquirerSelect, Separator, input, password as inquirerPassword } from '@inquirer/prompts';
import { exec } from 'child_process';
import { compare } from 'compare-versions';
import chalk from 'chalk';
import { configs } from './configs';
import pkgInfo from '../../package.json';

const HOURS = (1000) * (60) * (60);

interface Choice<T> {
    name: string;
    value: T;
    description?: string;
}

// Fire-and-forget update check (non-blocking)
export const checkForUpdates = async () => {
    try {
        const zeusProfile = await configs.zeusProfile.load();
        if (zeusProfile?.lastUpdateCheck === undefined || Date.now() - zeusProfile?.lastUpdateCheck > (3 * HOURS)) {
            exec(`npm view ${pkgInfo.name} version`, { timeout: 5000 }, (error, stdout) => {
                if (error) return; // Silently fail on network issues
                
                const latestRemoteVersion = stdout.toString().trim();
                const currentVersion = pkgInfo.version;

                if (compare(latestRemoteVersion, currentVersion, '>')) {
                    console.log(chalk.yellow(`==================================================`))
                    console.log(chalk.yellow(`A new version (${latestRemoteVersion}) is available!\n`))
                    console.log(chalk.bold.yellow(`\tnpm install -g @layr-labs/zeus`))
                    console.log(chalk.yellow(`==================================================`))
                }
                
                configs.zeusProfile.write({
                    ...zeusProfile,
                    lastUpdateCheck: Date.now()
                }).catch(() => {
                    // Silently fail
                });
            });
        }
    } catch {
        // Silently fail - don't block on update check
    }
};

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