import path from 'path';
import os from 'os';
import { Octokit } from 'octokit';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { Enviornment } from './environment.js';
import { JSONBackedConfig } from './config.js';

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
    environment?: Enviornment | undefined;
}

// get all zeus-state, from environment variables + repo.
export async function load(args?: {env: string}): Promise<TState> {
    const profile = await configs.zeusProfile.load();
    const zeusRepo = await configs.zeus.load();

    var zeusHostOwner: string | undefined;
    var zeusHostRepo: string | undefined;

    if (zeusRepo) {
        try {
            const urlObj = new URL(zeusRepo.zeusHost);
            const pathComponents = urlObj.pathname.split('/').filter(Boolean);
            const [owner, repo] = pathComponents.slice(-2);
            zeusHostOwner = owner;
            zeusHostRepo = repo;
        } catch {
            console.warn('invalid ZEUS_HOST. Expected a github url.');
        };
    }

    if (profile?.accessToken) {
        // check if token is live
        const client = new Octokit({auth: profile?.accessToken})
        try {
            await client.rest.users.getAuthenticated();
            return {
                github: client,
                zeusHostOwner,
                zeusHostRepo,
                environment: args?.env ? new Enviornment(client, args.env!) : undefined,
            }

            // load the environment if it's available
        } catch (e) {
            // log out the user.
            configs.zeusProfile.write({
                accessToken: undefined
            })
        }
    } 

    // logged-out
    return {
        zeusHostOwner,
        zeusHostRepo,
    }
}

export function requiresRepo<Args extends any[], Returns>(fn: (...args: Args) => Promise<Returns>) {
    return async (..._args: Args) => {
        const repoConfig = await configs.zeus.load();
        if (!repoConfig) {
            console.error('This command should be run from within a repository containing a `.zeus` file.');
            process.exit(1);
        }
        return await fn(..._args);
    }
}

export function requiresLogin<Args extends any[], T, Returns>(fn: (user: TState, cliArgs: T, ...args: Args) => Promise<Returns>) {
    return async (cliArgs: T, ..._args: Args) => {
        const state = await load();
        if (!state.github) {
            console.error(chalk.red('this action requires authentication. please login via `zeus login`'));
            process.exit(1);
        }
        await fn(state, cliArgs, ..._args);
    }
  }