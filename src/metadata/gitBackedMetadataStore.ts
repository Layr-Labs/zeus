import { dotZeus, TZeusState } from '../commands/inject.js';
import {login} from './loginServer.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

export class GitMetadataStore {
    environment?: string;
    repo?: string;

    async triggerLogin(): Promise<void> {
        const token = await login();
        
        // store the token in ~/.zeus
        writeFileSync(
            dotZeus(),
            JSON.stringify({accessToken: token} as TZeusState),
        )
        console.log(`Updated ${dotZeus()}`)
    }

    constructor(args?: {environment: string, repo: string}) {
        this.environment = args?.environment;
        this.repo = args?.repo;
    }
}

