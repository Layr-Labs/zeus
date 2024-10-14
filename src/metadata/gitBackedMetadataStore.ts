import { configs } from '../commands/inject';
import {login as loginToGithub} from './github';
import { MetadataStore, TDirectory } from './metadataStore';
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
        return true;
    }

    constructor(args: {owner: string, repo: string, branch?: string}) {
        this.owner = args?.owner;
        this.repo = args?.repo;
        this.branch = args?.branch;
    }

    async initialize(): Promise<void> {
        try {
            const config = await configs.zeusProfile.load();
            this.accessToken = config?.accessToken
            if (this.accessToken) {
                this.octokit = new Octokit({auth: this.accessToken});
            }
        } catch {}
    }

    async isLoggedIn(): Promise<boolean> {
        const client = new Octokit({auth: this.accessToken})
        try {
            await client.rest.users.getAuthenticated();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getFile(path: string): Promise<string | undefined> {
        try {
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
            } 
        } catch (e) {
            if (`${e}`.includes('Not Found')) {
                return undefined;
            }

            throw e;
        }
    } 

    async getDirectory(path: string): Promise<TDirectory | undefined> {
        try {
            const response = await this.octokit!.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path,
                ref: this.branch,
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
            return undefined;
        }
    }

    async getJSONFile<T>(path: string): Promise<T | undefined> {
        const contents = await this.getFile(path);
        if (!contents) {
            return undefined;
        }
        return JSON.parse(contents) as T;
    }

    async updateJSON<T>(path: string, contents: T): Promise<void> {
        const content = JSON.stringify(contents, null, 2);
        return await this.updateFile(path, content);
    }

    async updateFile(path: string, contents: string): Promise<void> {
        let response: any;
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

