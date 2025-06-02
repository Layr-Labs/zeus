import { JSONBackedConfig } from './config';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import fs from 'fs';

export const getRepoRoot = () => {
    return execSync('git rev-parse --show-toplevel').toString('utf-8').trim();
}

// Finds the shallowest .zeus file within the repository
const findClosestZeusFile = async (): Promise<string> => {
    const repoRoot = getRepoRoot();
    const rootZeusFile = path.join(repoRoot, '.zeus');
    
    // Check root first - most common case
    if (fs.existsSync(rootZeusFile)) return rootZeusFile;
    
    // Search for .zeus files in subdirectories
    try {
        const files = execSync('git ls-files -co --exclude-standard "*/.zeus"', { 
            cwd: repoRoot,
            encoding: 'utf-8' 
        })
        .trim()
        .split('\n')
        .filter(Boolean)
        .sort((a, b) => a.split('/').length - b.split('/').length);
        
        if (files[0]) return path.join(repoRoot, files[0]);
    } catch {}

    return rootZeusFile;
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
            return findClosestZeusFile();
        },
    }),
    zeusProfile: new JSONBackedConfig<TZeusProfile>({
        defaultPath: async () => path.resolve(os.homedir(), '.zeusProfile')
    })
}
