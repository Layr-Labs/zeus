import { exec as execCallback } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
const exec = promisify(execCallback);
import { MetadataStore, Transaction } from '../metadataStore';
import { LocalCloneTransaction } from './LocalCloneTransaction';
import { existsSync, mkdirSync, rmdirSync } from 'fs';
import { keccak256, toHex } from 'viem';


// -------------------------------------------------------
// LocalCloneMetadataStore
// -------------------------------------------------------

const GIT_CLONE = `git clone --single-branch --branch=master --depth 1`;

export class LocalCloneMetadataStore implements MetadataStore {
    private remoteRepoUrl: string;
    private localPath?: string;
    private initialized = false;

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
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        const loc = keccak256(toHex(this.remoteRepoUrl)).substring(2, 8); // 6 strings 
        
        const localUrl = path.join(process.env.HOME as string, '.zeus', 'data', loc);
        const localUrlGit = path.join(process.env.HOME as string, '.zeus', 'data', loc, '.git');
        try {
            if (!existsSync(localUrl) || !existsSync(localUrlGit)) {
                try {
                    rmdirSync(localUrl);
                } catch (_e) {
                    // force rm.
                }
                mkdirSync(localUrl, {recursive: true});
                await exec(`${GIT_CLONE} ${this.remoteRepoUrl} ${localUrl}`);
            } else {
                // sync to tip.
                await exec(`cd ${localUrl} && git clean -fd && git checkout . && git pull origin master`);
            } 
        } catch (e) {
            // if anything fails, rm the dir and reclone.
            console.error(`Experienced an error while syncing zeus: (reclone may be slower) ${e}`);
            rmdirSync(localUrl);
            mkdirSync(localUrl, {recursive: true});
            await exec(`${GIT_CLONE} ${this.remoteRepoUrl} ${localUrl}`);
        }
        this.localPath = localUrl;
    }

    async begin(options?: {verbose?: boolean}): Promise<Transaction> {
        if (!this.localPath) {
            throw new Error('Local repository not initialized. Call initialize() first.');
        }

        return new LocalCloneTransaction(this.localPath, !!options?.verbose);
    }
}
