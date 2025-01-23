import { Transaction, SavebleDocument, TDirectory } from "../metadataStore";
import { Octokit } from 'octokit';
import { GithubJsonDocument } from "./GithubJsonDocument";

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
            console.error(`[txn] Failed to commit metadata -- an update occurred while you were modifying state. Please try again. (latest=${latestCommitSha},base=${this.baseCommitHash})`);
            return;
        }

        const { data: commitData } = await this.octokit.rest.git.getCommit({
            ...ghArgs,
            commit_sha: this.baseCommitHash,
        });
        const baseTreeSha = commitData.tree.sha; // This is the tree of the base commit
        const tree = changedFiles.map((file) => ({
            path: file.path,
            mode: '100644', // File mode for regular files
            type: 'blob',
            content: file.pendingSaveableContents(), // The new content for the file
          } as const));

        const { data: newTreeData } = await this.octokit.rest.git.createTree({
            ...ghArgs,
            base_tree: baseTreeSha, // The base tree to build upon
            tree,
        });
    
        // Create a new commit with the new tree
        const { data: newCommitData } = await this.octokit.rest.git.createCommit({
            ...ghArgs,
            message: log,
            tree: newTreeData.sha,
            parents: [this.baseCommitHash], // Your existing base commit is the parent of the new commit
        });
        await this.octokit.rest.git.updateRef({
            ...ghArgs,
            ref: `heads/${this.branch}`,
            sha: newCommitData.sha,
        });

        this._files.forEach(f => f.wasSavedOptimistically()); // indicate that all of these have been updated.
        this.baseCommitHash = newCommitData.sha;
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
