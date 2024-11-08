
import { Octokit } from 'octokit';
import chalk from 'chalk';
import { MetadataStore } from '../metadata/metadataStore';
import { GithubMetadataStore } from '../metadata/github/GithubMetadataStore';
import { configs } from './configs';

// a super-set of logged in and logged out state.
export interface TState {
    github?: Octokit | undefined; 
    zeusHostOwner: string | undefined;
    zeusHostRepo: string | undefined;
    metadataStore?: MetadataStore | undefined;
}

export interface TLoggedInState extends TState {
    metadataStore: MetadataStore
    github: Octokit
};

export function isLoggedIn(state: TState): state is TLoggedInState {
    return !!state.github;
}

export function assertLoggedIn(state: TState): TLoggedInState {
    if (!isLoggedIn(state)) {
        throw new Error(`requires login`);
    }

    return state;
}

// get all zeus-state, from environment variables + repo.
export async function load(): Promise<TState> {
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
            metadataStore = new GithubMetadataStore({owner: zeusHostOwner, repo: zeusHostRepo});
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

    return {
        zeusHostOwner,
        zeusHostRepo,
        metadataStore,
        github: metadataStore ? (metadataStore as unknown as GithubMetadataStore)?.octokit : undefined,
    };
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
    if (!isLoggedIn(state)) {
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
