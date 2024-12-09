
jest.unstable_mockModule('../../metadata/github/github', () => ({
    login: jest.fn<() => Promise<string>>().mockImplementation(async () => {
        return 'mockAccessToken';
    }),
}));
jest.unstable_mockModule('octokit', () => {
    return {
        Octokit: jest.fn().mockImplementation(() => {
            return mockOctokitInstance
        })
    }
});
jest.unstable_mockModule('../../commands/configs', () => ({
    configs: {
        zeusProfile: {
            write: jest.fn(),
            load: jest.fn(),
        },
    },
}));

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
const GMS = await import('../../metadata/github/GithubMetadataStore');
const GHT = await import('../../metadata/github/GithubTransaction');
import { GithubMetadataStore } from '../../metadata/github/GithubMetadataStore';
import type { GithubTransaction } from '../../metadata/github/GithubTransaction';
const { configs } = await import('../../commands/configs');

const mockOctokitInstance = {
    rest: {
        repos: {
            get: jest.fn(),
            getBranch: jest.fn(),
        },
        users: {
            getAuthenticated: jest.fn(),
        },
    },
};

describe('GithubMetadataStore', () => {
    let store: GithubMetadataStore;

    beforeEach(() => {
        store = new GMS.GithubMetadataStore({ owner: 'testOwner', repo: 'testRepo', branch: 'testBranch' });
        GMS.GithubMetadataStore.isAuthTokenValid = jest.fn<typeof GithubMetadataStore.isAuthTokenValid>().mockResolvedValue(true);
    });

    describe('getOctokit', () => {
        it('should throw an error if octokit is not initialized', () => {
            expect(() => store.getOctokit()).toThrow('MetadataStore not initialized');
        });

        it('should return the octokit instance if initialized', async () => {
            await store.login();
            expect(store.getOctokit()).toBeDefined();
        });
    });

    describe('login', () => {
        it('should set octokit and write accessToken to config', async () => {
            await store.login();

            expect(configs.zeusProfile.write).toHaveBeenCalledWith({ accessToken: 'mockAccessToken' });
            expect(store.getOctokit()).toBeDefined();
        });
    });

    describe('initialize', () => {
        it('should initialize octokit if accessToken is found in config', async () => {
            (configs.zeusProfile.load as jest.Mock<typeof configs.zeusProfile.load>).mockResolvedValue({ accessToken: 'mockAccessToken' });
            await store.initialize();

            expect(store.getOctokit()).toBeDefined();
        });

        it('should throw an error if initialization fails', async () => {
            (configs.zeusProfile.load as jest.Mock<typeof configs.zeusProfile.load>).mockRejectedValue(new Error('Load failed'));
            await expect(store.initialize()).rejects.toThrow('failed to initialize');
        });
    });

    describe('getBranch', () => {
        beforeEach(async () => {(
            configs.zeusProfile.load as jest.Mock<typeof configs.zeusProfile.load>).mockResolvedValue({ accessToken: 'mockAccessToken' });
            await store.initialize();
        })
        it('should return the branch if already set', async () => {
            const branch = await store.getBranch();
            expect(branch).toBe('testBranch');
        });

        it('should fetch and return the default branch if not set', async () => {
            store.branch = undefined;
            // @ts-expect-error typing isn't straightforward
            (mockOctokitInstance.rest.repos.get as jest.Mock).mockResolvedValue({ data: { default_branch: 'main' } }); 

            const branch = await store.getBranch();
            expect(branch).toBe('main');
        });
    });

    describe('begin', () => {
        beforeEach(async () => {(
            configs.zeusProfile.load as jest.Mock<typeof configs.zeusProfile.load>).mockResolvedValue({ accessToken: 'mockAccessToken' });
            await store.initialize();
        })
        
        it('should return a GithubTransaction instance with the correct data', async () => {
            // @ts-expect-error typing isn't straightforward on the mocked instance.
            mockOctokitInstance.rest.repos.getBranch.mockResolvedValue({ data: { commit: { sha: 'mockCommitSha' } } });

            const transaction = await store.begin();
            expect(transaction).toBeInstanceOf(GHT.GithubTransaction);
            expect((transaction as GithubTransaction).branch).toBe('testBranch');
            expect((transaction as GithubTransaction).baseCommitHash).toBe('mockCommitSha');
        });
    });

    describe('isLoggedIn', () => {
        it('should return true if the user is authenticated', async () => {
            store.accessToken = "test";
            const result = await store.isLoggedIn();
            expect(result).toBe(true);
        });

        it('should return false if authentication fails', async () => {
            // @ts-expect-error typing isn't straightforward on the mocked instance.
            mockOctokitInstance.rest.users.getAuthenticated.mockRejectedValue(new Error('Not authenticated'));

            const result = await store.isLoggedIn();
            expect(result).toBe(false);
        });
    });
});
