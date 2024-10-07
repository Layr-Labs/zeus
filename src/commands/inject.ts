import path from 'path';
import os from 'os';
import { Octokit } from 'octokit';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { Enviornment } from './environment.js';
import { JSONBackedConfig } from './config.js';

export type TZeusConfig = {
    zeusHost: string,
}

export type TZeusProfile = {
    accessToken: string | undefined,
}

export const configs = {
    zeus: new JSONBackedConfig<TZeusConfig>({
        defaultPath: async () => {
            const repoRoot = execSync('git rev-parse --show-toplevel').toString('utf-8');
            return path.join(repoRoot, '.zeus');
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
    const repoConfig = await configs.zeus.load();
    const profile = await configs.zeusProfile.load();

    if (!repoConfig) {
        console.error('Zeus should be run from within a contracts repository containing a `.zeus` file.');
        throw new Error('Aborting.');
    }

    var zeusHostOwner: string | undefined;
    var zeusHostRepo: string | undefined;

    if (process.env.ZEUS_HOST) {
        try {
            const urlObj = new URL(process.env.ZEUS_HOST!);
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

export function requiresLogin<Args extends any[], T, Returns>(fn: (user: TState, cliArgs: T, ...args: Args) => Promise<Returns>) {
    return async (cliArgs: T, ..._args: Args) => {
        const state = await load();
        if (!state.github) {
            console.error(chalk.red('this action requires authentication. please login via `zeus login`'));
            process.exit(1);
        }
        if (!state.zeusHostOwner || !state.zeusHostRepo) {
            console.error(chalk.red('please set a valid ZEUS_HOST repo in your terminal.'));
            process.exit(2);
        }
        await fn(state, cliArgs, ..._args);
    }
  }