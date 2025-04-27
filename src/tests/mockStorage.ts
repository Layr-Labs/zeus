import { MetadataStore, SavebleDocument, TDirectory, Transaction } from "../metadata/metadataStore";
import {sep} from 'path';
import {jest} from '@jest/globals';

const jsonDeepCopy = (item: unknown) => {
    return JSON.parse(JSON.stringify({item})).item
}

function serialize(item: string | object | undefined | null) {
    if (item === undefined) {
        return ''
    } else if (item === null) {
        return '<dir>'  
    } else if (typeof item != 'object') {
        return `${item}`;
    } else {
        return JSON.stringify(item, null, 2);
    }
}


export class MockFile<T extends string | object> implements SavebleDocument<T> {
    contents: string;
    path: string;
    _: T;
    _saved: T; // contents that have been saved in the local copy.
    readonly inTransaction: boolean;
    private _remote: T; // the current up-to-date file, from the perspective of what is written on disk
    
    get dirty(): boolean {
        return JSON.stringify(this._saved) !== JSON.stringify(this._remote);
    }

    get upToDate(): boolean {
        const up = JSON.stringify(this._saved, null, 2) === JSON.stringify(this._remote, null, 2);
        return up;
    }

    constructor(filePath: string, contents: string, parsedContents: T, inTransaction: boolean) {
        this.path = filePath;
        this.contents = contents;
        this._ = parsedContents;
        this._saved = jsonDeepCopy(this._);
        this._remote = jsonDeepCopy(this._);
        this.inTransaction = inTransaction;
    }

    async save(): Promise<void> {
        this._saved = jsonDeepCopy(this._);
        if (this.inTransaction) {
            // the actual save operation will occur during `commit`.
            return;
        }
    }

    wasSavedOptimistically(): void {
        this._remote = jsonDeepCopy(this._saved); // in this implementation, "_remote" represents what is stored on disk locally (vs. in memory)
    }

    pendingSaveableContents(): string {
        return serialize(this._saved);
    }
}


export class MockTransaction implements Transaction {
    refs: Record<string, SavebleDocument<unknown>>;

    constructor(private files: Record<string, string | object | undefined | null>) {
        this.refs = {};
    }

    async getDirectory(pathToSearch: string): Promise<TDirectory> {
        const seen = new Set();
        return Object.keys(this.files).filter(path => path.startsWith(pathToSearch)).map(path => {
            const dirEntry = this.files[path];
            const pathSuffix = path.slice(pathToSearch.length+1);
            if (pathSuffix.includes(sep)) {
                // this entry  contains a longer path, and thus implies the existence of a directory.
                const childDir = pathSuffix.split(sep)[0];
                return {
                    type: 'dir',
                    name: childDir,
                    debug: {
                        pathSuffix,
                        pathToSearch,
                        path
                    }
                }
            }
            return {
                type: dirEntry === null ? 'dir' : 'file',
                name: path.slice(pathToSearch.length)
            };
        }).filter(u => u).filter(item => {
            const id = `${item.type}-${item.name}`;
            if (seen.has(id)) {
                return false; // duplicate
            }
            seen.add(id);
            return true;
        }) as TDirectory;
    }

    async getJSONFile<T extends object>(path: string): Promise<SavebleDocument<T>> {
        if (!this.refs[path]) {
            this.refs[path] = new MockFile<T>(path, serialize(this.files[path]), this.files[path] as T, true);
            jest.spyOn(this.refs[path], 'save');
        }

        return this.refs[path] as SavebleDocument<T>;
    }

    async commit(_log: string): Promise<void> {
        // unsupported.
    }

    hasChanges(): boolean {
        return false; // unsupported
    }
}


export class MockMetadataStore implements MetadataStore {
    transaction: MockTransaction;

    // - "null" indicates that the path is a directory.
    // - "undefined" indicates that the path is not real.
    constructor(private files?: Record<string, string | object | undefined | null>) {
        this.transaction = new MockTransaction(this.files ?? {});
        jest.spyOn(this.transaction, 'commit');
        jest.spyOn(this.transaction, 'getDirectory');
        jest.spyOn(this.transaction, 'getJSONFile');
    }

    async login() {
        return false;
    }
   
    async isLoggedIn() {
        return false;
    }

    // async constructor
    async initialize() {
        // stubbed
    }

    async begin(_options?: {verbose?: boolean}): Promise<Transaction> {
        return this.transaction;
    }
}