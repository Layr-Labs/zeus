
import { JSONBackedConfig } from './config';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export const getRepoRoot = () => {
    return execSync('git rev-parse --show-toplevel').toString('utf-8').trim();
}

export type TZeusConfig = {
    zeusHost: string,
    migrationDirectory: string
}

export type TZeusProfile = {
    accessToken: string | undefined,
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