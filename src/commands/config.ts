
import { readFileSync, writeFileSync } from 'fs';

export class JSONBackedConfig<T> {
    defaultPath: () => Promise<string>;
    providedPath: string | undefined;

    constructor(options: {path?: string | undefined, defaultPath: () => Promise<string>}) {
        this.providedPath = options.path;
        this.defaultPath = options.defaultPath;
    }

    async load(): Promise<T> {
        const path = this.providedPath ? this.providedPath : await this.defaultPath();
        return JSON.parse(readFileSync(path, {encoding: 'utf-8'})) as T;
    }

    async write(value: T): Promise<void> {
        const path = this.providedPath ? this.providedPath : await this.defaultPath();
        return writeFileSync(path, JSON.stringify(value, null, 4))
    }
}
