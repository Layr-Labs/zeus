
import { Octokit } from 'octokit';
import chalk from 'chalk';
import { MetadataStore } from '../metadata/metadataStore';
import { GithubMetadataStore } from '../metadata/github/GithubMetadataStore';
import { configs } from './configs';
import { LocalCloneMetadataStore } from '../metadata/clone/LocalCloneMetadataStore';

// a super-set of logged in and logged out state.
export interface TState {
    github?: Octokit | undefined; 
    zeusHostOwner: string | undefined;
    zeusHostRepo: string | undefined;
    metadataStore?: MetadataStore | undefined;
    login: () => Promise<void>
}

export interface TInRepoState extends TState {
    metadataStore: MetadataStore
};

export interface TLoggedInState extends TState {
    metadataStore: MetadataStore
    github: Octokit
};

export function isLoggedIn(state: TState): state is TLoggedInState {
    return !!state.github;
}

export function isInRepo(state: TState): state is TInRepoState {
    return !!state.metadataStore;
}

export function assertInRepo(state: TState): TInRepoState {
    if (!isInRepo(state)) {
        throw new Error(`requires inRepo`);
    }

    return state;
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
    const zeusHost = zeusRepo?.zeusHost;
    let metadataStore: MetadataStore | undefined;

    const isLoggedIn = await (async () => {
        if (zeusProfile?.accessToken) {
            return await GithubMetadataStore.isAuthTokenValid(zeusProfile.accessToken);
        }
        return false;
    })();

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

    if (isLoggedIn) {
        // logged in experience.
        metadataStore = 
            (zeusHost !== undefined && zeusHostOwner !== undefined && zeusHostRepo !== undefined) ? 
            new GithubMetadataStore({owner: zeusHostOwner, repo: zeusHostRepo}) : undefined;
    } else {
        // logged out.
        if (zeusProfile?.accessToken) {
            // overwrite invalid old access token.
            console.warn("access token invalid - logging out automatically.");
            await configs.zeusProfile.write({
                accessToken: undefined
            })
        }
        
        metadataStore = zeusHost ? new LocalCloneMetadataStore(zeusHost) : undefined;
    }

    if (metadataStore) {
        await metadataStore.initialize();
    }

    return {
        login: async () => {
            if (isLoggedIn) {
                console.warn(`warning: already logged in.`);
            }

            if (zeusHost !== undefined && zeusHostOwner !== undefined && zeusHostRepo !== undefined) {
                await new GithubMetadataStore({owner: zeusHostOwner, repo: zeusHostRepo}).login();
            } else {
                throw new Error(`This must be run from within a repo with a '.zeus' file.`);
            }
        },
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
