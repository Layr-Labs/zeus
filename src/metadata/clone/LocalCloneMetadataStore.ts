import { exec as execCallback } from 'child_process';
import { mkdtemp } from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
const exec = promisify(execCallback);
import { MetadataStore, Transaction } from '../metadataStore';
import { LocalCloneTransaction } from './LocalCloneTransaction';


// -------------------------------------------------------
// LocalCloneMetadataStore
// -------------------------------------------------------
export class LocalCloneMetadataStore implements MetadataStore {
    private remoteRepoUrl: string;
    private localPath?: string;

    constructor(remoteRepoUrl: string) {
        this.remoteRepoUrl = remoteRepoUrl;
    }

    async login(): Promise<boolean> {
        return true;
    }

    async isLoggedIn(): Promise<boolean> {
        return false;
    }

    async initialize(): Promise<void> {
        // Clone the repository to a temp directory.
        const tmpDir = await mkdtemp(path.join(tmpdir(), 'local-clone-metadata-'));
        await exec(`git clone --depth 1 ${this.remoteRepoUrl} ${tmpDir}`);
        this.localPath = tmpDir;
    }

    async begin(options?: {verbose?: boolean}): Promise<Transaction> {
        if (!this.localPath) {
            throw new Error('Local repository not initialized. Call initialize() first.');
        }

        if (options?.verbose) {
            console.log(`Starting transaction in: ${this.localPath}`);
        }

        return new LocalCloneTransaction(this.localPath, !!options?.verbose);
    }
}
