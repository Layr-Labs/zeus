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
            console.error(`Failed initializing metadata.`)
            throw e;
        }
    }

    async begin(): Promise<Transaction> {
        const response = await this.octokit!.rest.repos.getBranch({
            owner: this.owner!,
            repo: this.repo!,
            branch: this.branch!, // You can specify a branch here
        });
        return new GithubTransaction(this.owner!, this.repo!, this.branch!, this.octokit!, response.data.commit.sha);
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

