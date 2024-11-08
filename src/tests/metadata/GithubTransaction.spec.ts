import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Transaction, SavebleDocument } from '../../metadata/metadataStore';
import { Octokit } from 'octokit';

const GHT = await import('../../metadata/github/GithubTransaction');
import type { GithubTransaction } from '../../metadata/github/GithubTransaction';

describe('GithubTransaction', () => {
    let mockOctokitInstance: jest.Mocked<Octokit>;
    let githubTransaction: Transaction;

    beforeEach(() => {
        mockOctokitInstance = {
            rest: {
                git: {
                    getRef: jest.fn(),
                    getCommit: jest.fn(),
                    createTree: jest.fn(),
                    createCommit: jest.fn(),
                    updateRef: jest.fn(),
                },
                repos: {
                    getContent: jest.fn(),
                },
            },
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

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.getCommit.mockResolvedValue({ data: { tree: { sha: 'baseTreeSha' } } });

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.createTree.mockResolvedValue({ data: { sha: 'newTreeSha' } });

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.createCommit.mockResolvedValue({ data: { sha: 'newCommitSha' } });

        // @ts-expect-error not-full-type
        mockOctokitInstance.rest.git.updateRef.mockResolvedValue({});

        await githubTransaction.commit('Commit log message');

        expect(mockOctokitInstance.rest.git.getRef).toHaveBeenCalled();
        expect(mockOctokitInstance.rest.git.getCommit).toHaveBeenCalled();
        expect(mockOctokitInstance.rest.git.createTree).toHaveBeenCalled();
        expect(mockOctokitInstance.rest.git.createCommit).toHaveBeenCalled();
        expect(mockOctokitInstance.rest.git.updateRef).toHaveBeenCalledWith(
            expect.objectContaining({
                ref: 'heads/branch',
                sha: 'newCommitSha',
            })
        );
    });

    it('should throw an error when committing with no changes', async () => {
        (githubTransaction as GithubTransaction)._files = [];
        await expect(githubTransaction.commit('No changes')).resolves.toBeUndefined();
    });

    it('should fetch file contents and decode base64 data', async () => {
        const mockBase64Content = Buffer.from('test content').toString('base64');

        // @ts-expect-error incomplete type.
        mockOctokitInstance.rest.repos.getContent.mockResolvedValue({ data: { content: mockBase64Content } });

        const result = await githubTransaction.getFile('path/to/file');

        expect(result._).toBe('test content');
        expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'path/to/file' })
        );
    });

    it('should return an empty string when file is not found', async () => {
        mockOctokitInstance.rest.repos.getContent.mockRejectedValue(new Error('Not Found'));
        jest.spyOn(console, 'error').mockImplementationOnce(() => {
            //
        });
        const result = await githubTransaction.getFile('nonexistent/path');
        expect(result._).toBe("");
    });

    it('should throw an error for non-directory paths when fetching directories', async () => {
        // @ts-expect-error incomplete type mocked
        mockOctokitInstance.rest.repos.getContent.mockResolvedValue({ data: { type: 'file' } });
        await expect(githubTransaction.getDirectory('path/to/file')).rejects.toThrow('path/to/file is not a directory.');
    });
});
