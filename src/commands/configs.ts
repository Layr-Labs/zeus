
import { JSONBackedConfig } from './config';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const getRepoRoot = () => {
    return execSync('git rev-parse --show-toplevel').toString('utf-8').trim();
}

export interface TZeusConfig {
    zeusHost: string,
    migrationDirectory: string
}

export interface TZeusProfile {
    accessToken?: string | undefined,
    zeusHost?: string | undefined,
    lastUpdateCheck?: number

    // warn if the zeusHost in the profile doesn't match the zeusHost in the repo you're working in.
    // default: true
    warnOnMismatch?: boolean
}

export const configs = {
    zeus: new JSONBackedConfig<TZeusConfig>({
        defaultPath: async () => {
            return path.join(getRepoRoot(), '.zeus');
        },
    }),
    zeusProfile: new JSONBackedConfig<TZeusProfile>({
        defaultPath: async () => path.resolve(os.homedir(), '.zeusProfile')
    })
}