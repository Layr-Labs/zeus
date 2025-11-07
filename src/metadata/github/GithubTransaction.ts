import { Transaction, SavebleDocument, TDirectory } from "../metadataStore";
import { Octokit } from 'octokit';
import { GithubJsonDocument } from "./GithubJsonDocument";

const CREATE_COMMIT_ON_BRANCH_MUTATION = `
    mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
            commit {
                oid
            }
        }
    }
` as const;

export class GithubTransaction implements Transaction {
    //  the commit that all changes are being made against
    baseCommitHash = '';
    owner: string;
    repo: string;
    branch: string;
    octokit: Octokit;

    // currently modified files. note that this resets after calling `commit`.
    _files: SavebleDocument<unknown>[] = [];
    _verbose: boolean;

    hasChanges(): boolean {
        return !!this._files.find(f => f.dirty);
    }

    toString(): string {
        if (!this.hasChanges()) {
            return "<empty>"
        } else {
            const changelog = this._files.filter(f => f.dirty).map(f => f.path)
            return JSON.stringify(changelog, null, 2);
        }
    }

    constructor(owner: string, repo: string, branch: string, octokit: Octokit, baseCommitHash: string, verbose: boolean) {
        this.owner = owner;
        this.repo = repo;
        this.octokit = octokit;
        this.branch = branch;
        this.baseCommitHash = baseCommitHash;
        this._files = [];
        this._verbose = verbose;
    }

    async commit(log: string): Promise<void> {
        const changedFiles = this._files.filter(f => !f.upToDate);
        if (!changedFiles || changedFiles.length === 0) {
            return;
        }

        const ghArgs = {owner: this.owner, repo: this.repo};
        const { data: refData } = await this.octokit.rest.git.getRef({
            ...ghArgs,
            ref: `heads/${this.branch}`,
        });
        const latestCommitSha = refData.object.sha;
        if (latestCommitSha !== this.baseCommitHash) {
            // someone ran a deploy while you were running. abort.
            console.warn(`[txn] warning: an update occurred while you were modifying state. (latest=${latestCommitSha},base=${this.baseCommitHash})`);
            return;
        }

        const additions = changedFiles.map((file) => ({
            path: file.path,
            contents: Buffer.from(file.pendingSaveableContents(), 'utf8').toString('base64'),
        }));

        const [headline, ...bodyLines] = (log ?? '').split('\n');
        const messageHeadline = headline && headline.trim().length > 0 ? headline : 'Update metadata';
        const body = bodyLines.join('\n').trim();
        const messageInput: { headline: string; body?: string } = { headline: messageHeadline };
        if (body.length > 0) {
            messageInput.body = body;
        }

        type TCreateCommitResponse = {
            createCommitOnBranch: {
                commit: {
                    oid: string;
                };
            };
        };

        const result = await this.octokit.graphql<TCreateCommitResponse>(CREATE_COMMIT_ON_BRANCH_MUTATION, {
            input: {
                branch: {
                    repositoryNameWithOwner: `${this.owner}/${this.repo}`,
                    branchName: this.branch,
                },
                fileChanges: {
                    additions,
                },
                expectedHeadOid: this.baseCommitHash,
                message: messageInput,
            },
        });

        const newCommitSha = result.createCommitOnBranch.commit.oid;
        this._files.forEach(f => f.wasSavedOptimistically()); // indicate that all of these have been updated.
        this.baseCommitHash = newCommitSha;
    }

    async getFileContents(path: string): Promise<string | undefined> {
        const existingFile = this._files.find(f => f.path === path);
        if (existingFile) {
            return existingFile.contents;
        }

        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref: this.baseCommitHash,
            });

            if ('content' in response.data) {
                // The content is base64-encoded, so decode it
                const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf8');
                return decodedContent;
            } 
        } catch (e) {
            if (`${e}`.includes('Not Found')) {
                return undefined;
            }

            throw e;
        }
    } 

    // TODO: this doesn't take into account files optimistically created in the txn...
    async getDirectory(path: string): Promise<TDirectory> {
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref: this.baseCommitHash,
            });

            if (Array.isArray(response.data)) {
                // This means the path is a directory, so we map the contents to the TDirectory type
                const directory: TDirectory = response.data.map(item => ({
                    type: item.type,
                    name: item.name,
                }));

                return directory;
            } else {
                // If the response is not an array, it's not a directory
                throw new Error(`${path} is not a directory.`);
            }
        } catch (error) {
            console.error(`Failed to get directory contents for path: ${path}`, error);
            throw error;
        }
    }

    async getJSONFile<T extends object>(path: string): Promise<SavebleDocument<T>> {
        const existingFile = this._files.find(f => f.path === path);
        if (existingFile) {
            return existingFile as SavebleDocument<T>;
        }

        const contents = await this.getFileContents(path);
        let obj: T | undefined = undefined;
        try {
            obj = JSON.parse(contents ?? '{}') as T;
        } catch {
            console.warn(`${path} was read as a JSON file but doesn't have valid JSON.`);
        }

        const file = new GithubJsonDocument<T>(obj ?? {} as T, path, true, { octokit: this.octokit, owner: this.owner, repo: this.repo, branch: this.branch}, {verbose: this._verbose});
        this._files.push(file);
        return file;
    }
}
