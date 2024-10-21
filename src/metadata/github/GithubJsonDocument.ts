import { SavebleDocument } from '../metadataStore';
import { Octokit } from 'octokit';

function jsonDeepCopy<T>(item: T): T {
    return JSON.parse(JSON.stringify({value: item})).value;
}

export class GithubJsonDocument<T> implements SavebleDocument<T> {
    updateSaveableString() {
        if (typeof this._ != 'object') {
            this._toSave = `${this._}`;
        } else {
            this._toSave = JSON.stringify(this._, null, 2);
        }
    }

    async save(): Promise<void> {
        this.updateSaveableString();
        
        if (this.inTransaction) {
            // the actual save operation will occur during `commit`.
            return;
        }

        await this.updateFile(this.path, this.pendingSaveableContents());
    }

    get dirty(): boolean {
        return JSON.stringify(this._) !== JSON.stringify(this._saved);
    }

    pendingSaveableContents(): string {
        return this._toSave;
    }

    path: string; // repo path of this file.
    _: T; // the contents, that you will typically modify when making changes. (latest, potentially unsaved changes)
    private _saved: T; // the current up-to-date file from the perspective of `save()`.
    private _toSave: string; // string contents that should be saved on the next commit in a txn.
    
    private inTransaction: boolean;
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private branch: string;

    constructor(contents: T, path: string, inTransaction: boolean, github: {octokit: Octokit, owner: string, repo: string, branch: string}) {
        this._ = jsonDeepCopy(contents);
        this._saved = jsonDeepCopy(contents);
        this.path = path;
        this.inTransaction = inTransaction;
        this.octokit = github.octokit;
        this.owner = github.owner;
        this.repo = github.repo;
        this.branch = github.branch;

        // this.updateSaveableString();
        if (typeof this._ == 'string') {
            this._toSave = this._;
        } else {
            this._toSave = JSON.stringify(this._);
        }
    }

    async updateJSON<T>(path: string, contents: T): Promise<void> {
        const content = JSON.stringify(contents, null, 2);
        return await this.updateFile(path, content);
    }

    async updateFile(path: string, contents: string): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const getContent = this.octokit!.rest.repos.getContent;

        let response: Awaited<ReturnType<typeof getContent>> | undefined;
        try {
            response = await this.octokit!.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref: this.branch,
            });
        } catch (e) {
            if (!`${e}`.includes('Not Found')) {
                // only throw if it's not a not found error.
                throw e;
            }
        }
 
        // Ensure the response is a file and cast to the correct type
        if (Array.isArray(response?.data)) {
            throw new Error(`The path ${path} is a directory, not a file.`);
        }

        const fileData = response?.data as { sha: string; content: string; path: string } | undefined;
        const updatedResponse = await this.octokit!.rest.repos.createOrUpdateFileContents({
            owner: this.owner,
            repo: this.repo,
            path,
            message: `Updated ${path}`,
            content: Buffer.from(contents).toString('base64'),
            sha: fileData?.sha, // Use the SHA from the fetched file
            branch: this.branch,
        });

        const sha = updatedResponse.data.content?.sha;
        if (!sha) {
            console.error("error: sha response empty")
            process.exit(1);
        }
    }

}   
