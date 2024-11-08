import { configs } from '../../commands/configs';
import {login as loginToGithub} from './github';
import { MetadataStore, Transaction } from '../metadataStore';
import { Octokit } from 'octokit';
import { GithubTransaction } from './GithubTransaction';


export class GithubMetadataStore implements MetadataStore {

    octokit: Octokit | undefined;
    environment?: string;
    owner: string;
    repo: string;
    branch?: string;
    accessToken?: string;

    getOctokit(): Octokit {
        if (!this.octokit) {
            throw new Error(`MetadataStore not initialized`);
        }
        return this.octokit;
    }

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
        } catch (e) {
            throw new Error(`failed to initialize`, {cause: e});
        }
    }

    async getBranch(): Promise<string> {
        if (this.branch) {
            return this.branch;
        }
        const { data: repoData } = await this.getOctokit().rest.repos.get({
            owner: this.owner,
            repo: this.repo,
        });
        return repoData.default_branch; 
    }

    async begin(args?: {verbose?: boolean}): Promise<Transaction> {
        const branch = await this.getBranch();
        const response = await this.getOctokit().rest.repos.getBranch({
            owner: this.owner,
            repo: this.repo,
            branch,
        });
        return new GithubTransaction(this.owner, this.repo, branch, this.getOctokit(), response.data.commit.sha, args?.verbose ?? false);
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
}

