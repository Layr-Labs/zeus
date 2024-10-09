import chalk from 'chalk';
import { configs } from '../commands/inject.js';
import {login as loginToGithub} from './github.js';
import { MetadataStore } from './metadataStore.js';
import { Octokit } from 'octokit';

export class GitMetadataStore implements MetadataStore {

    octokit: Octokit | undefined;
    environment?: string;
    owner: string;
    repo: string;
    branch?: string;
    accessToken?: string;

    async login(): Promise<boolean> {
        this.accessToken = await loginToGithub();
        if (this.accessToken) {
            this.octokit = new Octokit({auth: this.accessToken});
        }
        configs.zeusProfile.write({accessToken: this.accessToken})
        console.log(chalk.green(`+ Updated ${await configs.zeusProfile.path()}`))
        return true;
    }

    constructor(args: {owner: string, repo: string, branch?: string}) {
        this.owner = args?.owner;
        this.repo = args?.repo;
        this.branch = args?.branch;
    }

    async initialize(): Promise<void> {
        try {
            const config = configs.zeusProfile.load();
            config.then(c => {
                this.accessToken = c?.accessToken
                if (this.accessToken) {
                    this.octokit = new Octokit({auth: this.accessToken});
                }
            })
        } catch {}
    }

    async isLoggedIn(): Promise<boolean> {
        const client = new Octokit({auth: this.accessToken})
        try {
            await client.rest.users.getAuthenticated();
            return true;
        } catch {
            return false;
        }
    }

    async getPath(path: string): Promise<string> {
        const response = await this.octokit!.rest.repos.getContent({
            owner: this.owner!,
            repo: this.repo!,
            path,
            ref: this.branch, // You can specify a branch here
        });

        if ('content' in response.data) {
            // The content is base64-encoded, so decode it
            const decodedContent = Buffer.from(response.data.content, 'base64').toString('utf8');
            return decodedContent;
        } else {
            throw new Error('Content not found');
        }
    }

    async getJSONPath<T>(path: string): Promise<T> {
        return JSON.parse(await this.getPath(path)) as T;
    }

    async updatePath(path: string, contents: string): Promise<string> {
        const response = await this.octokit!.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path,
            ref: this.branch,
        });

        // Ensure the response is a file and cast to the correct type
        if (Array.isArray(response.data)) {
            throw new Error(`The path ${path} is a directory, not a file.`);
        }

        const fileData = response.data as { sha: string; content: string; path: string };

        const updatedResponse = await this.octokit!.rest.repos.createOrUpdateFileContents({
            owner: this.owner,
            repo: this.repo,
            path,
            message: `Updated ${path}`,
            content: Buffer.from(contents).toString('base64'),
            sha: fileData.sha, // Use the SHA from the fetched file
            branch: this.branch,
        });

        const sha = updatedResponse.data.content?.sha; // Return the new SHA after the update
        if (!sha) {
            console.error("error: sha response empty")
            process.exit(1);
        }

        return sha;
    }
}

