
jest.unstable_mockModule('child_process', () => {
    return {
        execSync: () => {
            return execSyncMockedReturn;
        }
    }
});

let execSyncMockedReturn: Buffer = Buffer.from('');

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { SavebleDocument } from '../../metadata/metadataStore';
import { Octokit } from 'octokit';
import fs from 'fs';

const GJD = await import('../../metadata/github/GithubJsonDocument');
import type { GithubJsonDocument } from '../../metadata/github/GithubJsonDocument';

describe('GithubJsonDocument', () => {
    let mockOctokitInstance: jest.Mocked<Octokit>;
    let githubJsonDocument: SavebleDocument<string | object>;

    beforeEach(() => {
        mockOctokitInstance = {
            rest: {
                repos: {
                    getContent: jest.fn(),
                    createOrUpdateFileContents: jest.fn(),
                },
            },
        } as unknown as jest.Mocked<Octokit>;

        githubJsonDocument = new GJD.GithubJsonDocument(
            { key: 'value' },
            'test/path/to/file.json',
            false,
            { octokit: mockOctokitInstance, owner: 'testOwner', repo: 'testRepo', branch: 'main' },
            { verbose: true }
        );
    });

    it('should correctly detect if the document is dirty', () => {
        (githubJsonDocument as GithubJsonDocument<object>)._saved = { key: 'value' };
        (githubJsonDocument as GithubJsonDocument<object>)['_remote'] = { key: 'differentValue' };
        expect(githubJsonDocument.dirty).toBe(true);
    });

    it('should correctly return upToDate status and log diff when verbose', () => {
        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            //
        });

        execSyncMockedReturn = Buffer.from('mock diff output', 'utf-8');
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            //
        });

        (githubJsonDocument as GithubJsonDocument<object>)._saved = { key: 'value' };
        (githubJsonDocument as GithubJsonDocument<object>)['_remote'] = { key: 'value' };
        expect(githubJsonDocument.upToDate).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('mock diff output'));
        
        consoleLogSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('should call updateFile with correct parameters when saving', async () => {
        jest.spyOn(githubJsonDocument as GithubJsonDocument<object>, 'updateFile').mockResolvedValue();
        await githubJsonDocument.save();

        expect((githubJsonDocument as GithubJsonDocument<object>).updateFile).toHaveBeenCalledWith(
            'test/path/to/file.json',
            expect.any(String)
        );
    });

    it('should throw an error when updating a file that is actually a directory', async () => {
        // @ts-expect-error unfilled type.
        mockOctokitInstance.rest.repos.getContent.mockResolvedValue({ data: [{ type: 'dir' }] });

        await expect((githubJsonDocument as GithubJsonDocument<object>).updateFile('test/path', '{}')).rejects.toThrow('The path test/path is a directory, not a file.');
    });

    it('should save content optimistically', async () => {
        jest.spyOn(githubJsonDocument as GithubJsonDocument<object>, 'updateFile').mockResolvedValue();
        (githubJsonDocument as GithubJsonDocument<object>)._ = { key: 'newValue' };
        await githubJsonDocument.save();
        githubJsonDocument.wasSavedOptimistically();

        expect((githubJsonDocument as GithubJsonDocument<object>)._).toEqual({ key: 'newValue' });
        expect((githubJsonDocument as GithubJsonDocument<object>)._saved).toEqual({ key: 'newValue' });
    });
});
