import { SavebleDocument } from '../metadataStore';
import { Octokit } from 'octokit';
import tmp from 'tmp';
import * as fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import chalk from 'chalk';

function jsonDeepCopy<T>(item: T): T {
    return JSON.parse(JSON.stringify({value: item})).value;
}

function serialize(item: string | object) {
    if (typeof item != 'object') {
        return `${item}`;
    } else {
        return JSON.stringify(item, null, 2);
    }
}

interface TOptions {
    verbose?: boolean;
}

export class GithubJsonDocument<T extends string | object> implements SavebleDocument<T> {
    wasSavedOptimistically() {
        this._ = jsonDeepCopy(this._saved);
        this._remote = jsonDeepCopy(this._saved);
    }

    async save(): Promise<void> {
        this._saved = jsonDeepCopy(this._);
        if (this.inTransaction) {
            // the actual save operation will occur during `commit`.
            return;
        }

        await this.updateFile(this.path, this.pendingSaveableContents());
    }

    get dirty(): boolean {
        return JSON.stringify(this._saved) !== JSON.stringify(this._remote);
    }

    get upToDate(): boolean {
        const up = JSON.stringify(this._saved, null, 2) === JSON.stringify(this._remote, null, 2);
        if (this.options?.verbose) {
            const filename = path.basename(this.path);
            const savedTmp = tmp.fileSync({postfix: filename, mode: 0o600});
            fs.writeFileSync(savedTmp.fd, JSON.stringify(this._saved, null, 2));

            const remoteTmp = tmp.fileSync({postfix: filename, mode: 0o600});
            fs.writeFileSync(remoteTmp.fd, JSON.stringify(this._remote, null, 2));
            
            const diff = execSync(`diff -u ${remoteTmp.name} ${savedTmp.name} || :`).toString('utf-8');

            diff.split('\n').forEach(line => {
                if (line.startsWith('+')) {
                    console.log(chalk.green(line));
                } else if (line.startsWith('-')) {
                    console.log(chalk.red(line));
                } else {
                    console.log(chalk.gray(line));
                }
            })
        }

        return up;
    }

    pendingSaveableContents(): string {
        return serialize(this._saved);
    }

    path: string; // repo path of this file.

    // the latest committed up-to-date contents of the file.
    get contents(): string {
        return serialize(this._remote);
    };
    
    _saved: T; // contents that have been saved in the local copy.
    _: T; // the contents, that you will typically modify when making changes. (latest, potentially unsaved changes)
    private _remote: T; // the current up-to-date file.
    
    private inTransaction: boolean;
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private branch: string;
    private options?: TOptions;

    constructor(contents: T, path: string, inTransaction: boolean, github: {octokit: Octokit, owner: string, repo: string, branch: string}, options?: TOptions) {
        this._ = jsonDeepCopy(contents);
        this._saved = jsonDeepCopy(contents);
        this._remote = jsonDeepCopy(contents);
        this.path = path;
        this.inTransaction = inTransaction;
        this.octokit = github.octokit;
        this.owner = github.owner;
        this.repo = github.repo;
        this.options = options;
        this.branch = github.branch;
    }

    async updateFile(path: string, contents: string): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const getContent = this.octokit.rest.repos.getContent;
        let response: Awaited<ReturnType<typeof getContent>> | undefined;
        try {
            response = await this.octokit.rest.repos.getContent({
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
        const updatedResponse = await this.octokit.rest.repos.createOrUpdateFileContents({
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
