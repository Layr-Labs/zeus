import path from 'path';
import os from 'os';
import { Octokit } from 'octokit';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { Environment } from './environment';
import { JSONBackedConfig } from './config';
import { MetadataStore } from '../metadata/metadataStore';
import { GitMetadataStore } from '../metadata/gitBackedMetadataStore';

export type TZeusConfig = {
    zeusHost: string,
    migrationDirectory: string
}

export type TZeusProfile = {
    accessToken: string | undefined,
}

export const getRepoRoot = () => {
    return execSync('git rev-parse --show-toplevel').toString('utf-8').trim();
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

export type TState = {
    github?: Octokit | undefined; 
    zeusHostOwner: string | undefined;
    zeusHostRepo: string | undefined;
    environment?: Environment | undefined;
    metadataStore?: MetadataStore | undefined;
}

// get all zeus-state, from environment variables + repo.
export async function load(args?: {env: string}): Promise<TState> {
    const zeusProfile = await configs.zeusProfile.load();
    const zeusRepo = await configs.zeus.load();

    let zeusHostOwner: string | undefined;
    let zeusHostRepo: string | undefined;
    let metadataStore: MetadataStore | undefined;
    
    if (zeusRepo) {
        try {
            const urlObj = new URL(zeusRepo.zeusHost);
            const pathComponents = urlObj.pathname.split('/').filter(Boolean);
            const [owner, repo] = pathComponents.slice(-2);
            zeusHostOwner = owner;
            zeusHostRepo = repo;
            metadataStore = new GitMetadataStore({owner: zeusHostOwner, repo: zeusHostRepo});
            await metadataStore.initialize();
        } catch {
            console.warn('invalid ZEUS_HOST. Expected a github url.');
        };
    }

    if (zeusProfile?.accessToken && metadataStore && !await metadataStore.isLoggedIn()) {
        console.log("logging out automatically.");
        await configs.zeusProfile.write({
            accessToken: undefined
        })
    }

    // logged-out
    return {
        zeusHostOwner,
        zeusHostRepo,
        metadataStore,
        github: metadataStore ? (metadataStore! as unknown as GitMetadataStore)?.octokit : undefined,
        environment: args?.env ? new Environment(args.env!) : undefined,
    }
}

type Predicate = () => Promise<void>

export function requires<Args extends unknown[], T, Returns>(fn: (user: TState, cliArgs: T, ...args: Args) => Promise<Returns>, ...predicates: Predicate[]) {
    return async (cliArgs: T, ..._args: Args) => {
        const state = await load();
        for (const predicate of predicates) {
            await predicate();
        }
        await fn(state, cliArgs, ..._args);
    }
}

export async function loggedIn(): Promise<void> {
    const state = await load();
    if (!state.metadataStore || !await state.metadataStore!.isLoggedIn()) {
        console.error(chalk.red('this action requires authentication. please login via `zeus login`'));
        process.exit(1);
    }
}

export async function inRepo(): Promise<void> {
    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error('This command should be run from within a repository containing a `.zeus` file.');
        process.exit(1);
    }
}
