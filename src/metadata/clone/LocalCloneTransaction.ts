import { Transaction, SavebleDocument, TDirectory } from "../metadataStore";
import { LocalSavebleDocument } from "./LocalCloneSaveableDocument";
import path, { join } from 'path';
import { promises as fs } from 'fs';

const exists = async (path: string) => {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

// -------------------------------------------------------
// LocalCloneTransaction
// -------------------------------------------------------
export class LocalCloneTransaction implements Transaction {
    private basePath: string;
    readonly verbose: boolean;
    _files: SavebleDocument<unknown>[] = [];

    constructor(basePath: string, verbose: boolean) {
        this.basePath = basePath;
        this.verbose = verbose;
    }

    toString(): string {
        if (!this.hasChanges()) {
            return "<empty>"
        } else {
            const changelog = this._files.filter(f => f.dirty).map(f => f.path)
            return JSON.stringify(changelog, null, 2);
        }
    }

    async getJSONFile<T extends object>(filePath: string): Promise<SavebleDocument<T>> {
        const existingFile = this._files.find(f => f.path === filePath);
        if (existingFile) {
            // NOTE: trying to take out a lease on a doc that isn't the same type will mess stuff up.
            return existingFile as unknown as SavebleDocument<T>;
        }

        const fullPath = path.join(this.basePath, filePath);
    
        const data = await (async () => {
            try {
                return await fs.readFile(fullPath, 'utf8');
            } catch {
                return '{}'
            }
        })();

        let parsed: T;
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            throw new Error(`Failed to parse JSON from ${filePath}: ${e}`);
        }
        const f = new LocalSavebleDocument<T>(this.basePath, filePath, data, parsed, true, {verbose: this.verbose});
        this._files.push(f);
        return f;
    }

    async getDirectory(dirPath: string): Promise<TDirectory> {
        const fullPath = path.join(this.basePath, dirPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        return entries.map((entry) => {
            const type = entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'unknown';
            return { type, name: entry.name };
        });
    }

    async commit(_log: string): Promise<void> {
        const changedFiles = this._files.filter(f => { 
            return !f.upToDate
        });

        if (!changedFiles || changedFiles.length === 0) {
            return;
        }

        for (const f of changedFiles) {
            const toWrite = f.pendingSaveableContents();
            const outPath = join(this.basePath, f.path);

            const basePath = path.dirname(outPath);
            if (!await exists(basePath)) {
                await fs.mkdir(basePath);
            }

            await fs.writeFile(outPath, toWrite);
            f.wasSavedOptimistically();
        }
    }

    hasChanges(): boolean {
        // Read-only means no changes are ever made.
        return false;
    }
}