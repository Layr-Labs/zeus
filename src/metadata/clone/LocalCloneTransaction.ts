import { Transaction, SavebleDocument, TDirectory } from "../metadataStore";
import { LocalSavebleDocument } from "./LocalCloneSaveableDocument";
import path from 'path';
import { promises as fs } from 'fs';

// -------------------------------------------------------
// LocalCloneTransaction
// -------------------------------------------------------
export class LocalCloneTransaction implements Transaction {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    async getFile(filePath: string): Promise<SavebleDocument<string>> {
        const fullPath = path.join(this.basePath, filePath);
        const data = await fs.readFile(fullPath, 'utf8');
        // For a string file, parsed version is just the string itself.
        return new LocalSavebleDocument<string>(filePath, data, data);
    }

    async getJSONFile<T extends object>(filePath: string): Promise<SavebleDocument<T>> {
        const fullPath = path.join(this.basePath, filePath);
        const data = await fs.readFile(fullPath, 'utf8');
        let parsed: T;
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            throw new Error(`Failed to parse JSON from ${filePath}: ${e}`);
        }
        return new LocalSavebleDocument<T>(filePath, data, parsed);
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
        // This is read-only, so committing is not allowed.
        throw new Error('This store is read-only. commit() not allowed.');
    }

    hasChanges(): boolean {
        // Read-only means no changes are ever made.
        return false;
    }
}