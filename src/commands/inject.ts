import path from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Octokit } from 'octokit';
import chalk from 'chalk';
import { Enviornment } from './environment.js';

export type TZeusState = {
    accessToken: string | undefined,
}

export function loadDotZeus(): TZeusState | undefined {
    try { 
        return existsSync(dotZeus()) ? JSON.parse(readFileSync(dotZeus(), {encoding: 'utf-8'})) as TZeusState : undefined;
    } catch {}
}

export function writeDotZeus(state: TZeusState) {
    try { 
        return writeFileSync(dotZeus(), JSON.stringify(state, null, 4))
    } catch {}
}

export function dotZeus(): string {
    return path.join(homedir(), '.zeus');
}

export type TState = {
    github?: Octokit | undefined; 
    zeusHostOwner: string | undefined;
    zeusHostRepo: string | undefined;
    environment?: Enviornment | undefined;
}

// get all zeus-state, from environment variables + repo.
export async function load(args?: {env: string}): Promise<TState> {
    const dotZeus = loadDotZeus();

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

    if (dotZeus?.accessToken) {
        // check if token is live
        const client = new Octokit({auth: dotZeus?.accessToken})
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
            writeDotZeus({
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