import { dirname } from "path";
import { JSONBackedConfig } from "../commands/config";

export class MockConfig<T> implements JSONBackedConfig<T> {
    defaultPath: () => Promise<string>;
    providedPath: string | undefined;

    constructor(private _value: T, _path: string) {
        this.defaultPath = async () => _path;
        this.providedPath = _path;
    }

    async path(): Promise<string> {
        return this.providedPath ? this.providedPath : await this.defaultPath();
    }

    async dirname(): Promise<string> {
        return dirname(await this.path());
    }

    async load(): Promise<T | undefined> {
        return this._value;
    }

    async write(value: T): Promise<void> {
        this._value = value;
    }
}