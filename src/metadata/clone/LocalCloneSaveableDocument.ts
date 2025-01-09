import path, { join } from "path";
import { SavebleDocument } from "../metadataStore";
import * as fs from 'fs';
import tmp from 'tmp';
import { execSync } from "child_process";
import chalk from "chalk";

const jsonDeepCopy = (item: unknown) => {
    return JSON.parse(JSON.stringify({item})).item
}

function serialize(item: string | object) {
    if (typeof item != 'object') {
        return `${item}`;
    } else {
        return JSON.stringify(item, null, 2);
    }
}

interface TOptions {
    verbose?: boolean;
}

// -------------------------------------------------------
// LocalSavebleDocument
// -------------------------------------------------------
export class LocalSavebleDocument<T extends string | object> implements SavebleDocument<T> {
    contents: string;
    path: string;
    _: T;
    _saved: T; // contents that have been saved in the local copy.
    readonly inTransaction: boolean;
    readonly rootPath: string;
    private _remote: T; // the current up-to-date file, from the perspective of what is written on disk
    readonly options: TOptions;

    get dirty(): boolean {
        return JSON.stringify(this._saved) !== JSON.stringify(this._remote);
    }

    get upToDate(): boolean {
        const up = JSON.stringify(this._saved, null, 2) === JSON.stringify(this._remote, null, 2);
        if (this.options?.verbose) {
            const filename = path.basename(this.path);
            const savedTmp = tmp.fileSync({postfix: filename, mode: 0o600});
            fs.writeFileSync(savedTmp.fd, JSON.stringify(this._saved, null, 2));

            const remoteTmp = tmp.fileSync({postfix: filename, mode: 0o600});
            fs.writeFileSync(remoteTmp.fd, JSON.stringify(this._remote, null, 2));
            
            const diff = execSync(`diff -u ${remoteTmp.name} ${savedTmp.name} || :`).toString('utf-8');

            diff.split('\n').forEach(line => {
                if (line.startsWith('+')) {
                    console.log(chalk.green(line));
                } else if (line.startsWith('-')) {
                    console.log(chalk.red(line));
                } else {
                    console.log(chalk.gray(line));
                }
            })
        }

        return up;
    }

    constructor(rootPath: string, filePath: string, contents: string, parsedContents: T, inTransaction: boolean, options: TOptions) {
        this.path = filePath;
        this.contents = contents;
        this._ = parsedContents;
        this._saved = jsonDeepCopy(this._);
        this._remote = jsonDeepCopy(this._);
        this.options = options;
        this.rootPath = rootPath;
        this.inTransaction = inTransaction;
    }

    async save(): Promise<void> {
        this._saved = jsonDeepCopy(this._);
        if (this.inTransaction) {
            // the actual save operation will occur during `commit`.
            return;
        }

        // save immediately if not in a transaction
        fs.writeFileSync(join(this.rootPath, this.path), JSON.stringify(this._saved));
    }

    wasSavedOptimistically(): void {
        this._remote = jsonDeepCopy(this._saved); // in this implementation, "_remote" represents what is stored on disk locally (vs. in memory)
    }

    pendingSaveableContents(): string {
        return serialize(this._saved);
    }
}