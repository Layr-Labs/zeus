import { configs } from '../commands/inject.js';
import {login} from './loginServer.js';

export class GitMetadataStore {
    environment?: string;
    repo?: string;

    async triggerLogin(): Promise<void> {
        const token = await login();
        
        // store the token in ~/.zeus
        configs.zeusProfile.write({accessToken: token})
        console.log(`Updated ${await configs.zeusProfile.path()}`)
    }

    constructor(args?: {environment: string, repo: string}) {
        this.environment = args?.environment;
        this.repo = args?.repo;
    }
}

