
import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';

export class JSONBackedConfig<T> {
    defaultPath: () => Promise<string>;
    providedPath: string | undefined;

    constructor(options: {path?: string | undefined, defaultPath: () => Promise<string>}) {
        this.providedPath = options.path;
        this.defaultPath = options.defaultPath;
    }

    async path(): Promise<string> {
        return this.providedPath ? this.providedPath : await this.defaultPath();
    }

    async load(): Promise<T | undefined> {
        try {
            return JSON.parse(readFileSync(await this.path(), {encoding: 'utf-8'})) as T;
        } catch {
            return undefined;
        }
    }

    async write(value: T): Promise<void> {
        writeFileSync(await this.path(), JSON.stringify(value, null, 4))
        console.log(chalk.green(`+ updated zeus config '${await this.path()}'`));
    }
}
