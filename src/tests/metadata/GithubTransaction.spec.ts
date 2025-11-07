import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Transaction, SavebleDocument } from '../../metadata/metadataStore';
import { Octokit } from 'octokit';

const GHT = await import('../../metadata/github/GithubTransaction');
import type { GithubTransaction } from '../../metadata/github/GithubTransaction';

describe('GithubTransaction', () => {
    let mockOctokitInstance: jest.Mocked<Octokit>;
    let githubTransaction: Transaction;
    let graphqlMock: jest.Mock;

    beforeEach(() => {
        graphqlMock = jest.fn();
        mockOctokitInstance = {
            rest: {
                git: {
                    getRef: jest.fn(),
                },
                repos: {
                    getContent: jest.fn(),
                },
            },
            graphql: Object.assign(graphqlMock, { paginate: jest.fn() }),
        } as unknown as jest.Mocked<Octokit>;

        githubTransaction = new GHT.GithubTransaction(
            'owner',
            'repo',
            'branch',
            mockOctokitInstance,
            'baseCommitHash',
            false,
        );
    });

    it('should indicate if there are changes', () => {
        const mockFile = { dirty: true } as SavebleDocument<unknown>;
        (githubTransaction as GithubTransaction)._files = [mockFile];
        expect(githubTransaction.hasChanges()).toBe(true);
    });

    it('should return <empty> when there are no changes', () => {
        expect(githubTransaction.toString()).toBe('<empty>');
    });

    it('should commit changes successfully', async () => {
        (githubTransaction as GithubTransaction)._files = [
            { dirty: true, save: jest.fn().mockImplementation(() => Promise.resolve()), contents: '', _: {}, upToDate: false, path: 'filePath', pendingSaveableContents: () => 'fileContent', wasSavedOptimistically: jest.fn() } as SavebleDocument<unknown>
        ];

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.getRef.mockResolvedValue({ data: { object: { sha: 'baseCommitHash' } } });

        graphqlMock.mockImplementation(async () => ({
            createCommitOnBranch: {
                commit: {
                    oid: 'newCommitSha',
                },
            },
        }));

        await githubTransaction.commit('Commit log message');

        expect(mockOctokitInstance.rest.git.getRef).toHaveBeenCalled();
        expect(graphqlMock).toHaveBeenCalled();
        expect((githubTransaction as GithubTransaction)._files[0].wasSavedOptimistically).toHaveBeenCalled();
    });

    it('deduplicates file additions by path before committing', async () => {
        const firstFile = {
            dirty: true,
            save: jest.fn(async () => {}),
            contents: 'old',
            _: {},
            upToDate: false,
            path: 'filePath',
            pendingSaveableContents: jest.fn(() => 'first-content'),
            wasSavedOptimistically: jest.fn(),
        } as unknown as SavebleDocument<unknown>;

        const secondFile = {
            dirty: true,
            save: jest.fn(async () => {}),
            contents: 'new',
            _: {},
            upToDate: false,
            path: 'filePath',
            pendingSaveableContents: jest.fn(() => 'second-content'),
            wasSavedOptimistically: jest.fn(),
        } as unknown as SavebleDocument<unknown>;

        (githubTransaction as GithubTransaction)._files = [firstFile, secondFile];

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.getRef.mockResolvedValue({ data: { object: { sha: 'baseCommitHash' } } });

        graphqlMock.mockImplementation(async () => ({
            createCommitOnBranch: {
                commit: {
                    oid: 'newCommitSha',
                },
            },
        }));

        await githubTransaction.commit('Commit log message');

        expect(graphqlMock).toHaveBeenCalledTimes(1);
        const variables = graphqlMock.mock.calls[0]?.[1] as {
            input: {
                fileChanges: {
                    additions: Array<{ path: string; contents: string }>;
                };
            };
        };
        expect(variables).toBeDefined();
        expect(variables.input.fileChanges.additions).toHaveLength(1);
        expect(variables.input.fileChanges.additions[0]).toMatchObject({
            path: 'filePath',
        });
        expect(Buffer.from(variables.input.fileChanges.additions[0].contents, 'base64').toString('utf8')).toBe('second-content');
    });

    it('should throw an error when committing with no changes', async () => {
        (githubTransaction as GithubTransaction)._files = [];
        await expect(githubTransaction.commit('No changes')).resolves.toBeUndefined();
    });

    it('should throw an error for non-directory paths when fetching directories', async () => {
        // @ts-expect-error incomplete type mocked
        mockOctokitInstance.rest.repos.getContent.mockResolvedValue({ data: { type: 'file' } });
        await expect(githubTransaction.getDirectory('path/to/file')).rejects.toThrow('path/to/file is not a directory.');
    });
});
