
import { JSONBackedConfig } from './config';
import path, { join, normalize } from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

// report the repoRoot as the closest directory containing a `.zeus` file.
export const getRepoRoot = () => {
    const root = execSync('git rev-parse --show-toplevel').toString('utf-8').trim();

    const zeusConfigPath = join(root, 'zeus');
    if (existsSync(zeusConfigPath)) {
        const config = JSON.parse(readFileSync(zeusConfigPath, 'utf-8')) as TZeusConfig;
        const suppliedRoot = config.root;
        if (suppliedRoot) {
            return normalize(join(root, suppliedRoot));
        }
    }
    
    return root;
}

export interface TZeusConfig {
    /**
     * The default zeusHost that people should submit metadata to while using
     * your repository.
     */
    zeusHost: string,

    /**
     * Relative to $root, where are your migrations located?
     */
    migrationDirectory: string

    /**
     * The root path that the contracts / zeus project is located under. This path is
     * relative to the repo root.
     */
    root?: string
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