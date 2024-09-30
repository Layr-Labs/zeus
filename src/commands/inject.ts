import path from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Octokit } from 'octokit';
import chalk from 'chalk';

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
    zeusHost: string;
}

// get all zeus-state, from environment variables + repo.
export async function load(): Promise<TState> {
    const dotZeus = loadDotZeus();

    if (dotZeus?.accessToken) {
        // check if token is live
        const client = new Octokit({auth: dotZeus?.accessToken})
        try {
            await client.rest.users.getAuthenticated();
            return {
                github: client,
                zeusHost: process.env.ZEUS_HOST!,
            }
        } catch (e) {
            // log out the user.
            console.error(`Access token expired, logging out.`, e);
            writeDotZeus({
                accessToken: undefined
            })
        }
    } 

    // logged-out
    return {
        zeusHost: process.env.ZEUS_HOST!,
    }
}

export function requiresLogin<Args extends any[], Returns>(fn: (user: TState, ...args: Args) => Promise<Returns>) {
    return async (..._args: Args) => {
        const state = await load();
        if (!state.github) {
            console.error(chalk.red('this action requires authentication. please login via `zeus login`'));
            process.exit(1);
        }
        await fn(state, ..._args);
    }
  }