import { jest } from "@jest/globals";
import { Strategy } from "../signing/strategy.js";
import { MetadataStore, TDirectory } from "../metadata/metadataStore.js";

export async function mockForgeReturnOnce(args: {code?: number, response: any, stderr?: string}) {
    const spy = await jest.spyOn(Strategy, "runWithArgs");
    spy.mockResolvedValueOnce({
        code: args.code ?? 0,
        stdout: JSON.stringify(args.response),
        stderr: args.stderr ?? ''
    });
}

export class MockMetadataStore implements MetadataStore {
    files: Record<string, string> = {};
    directories: Record<string, TDirectory> = {};

    async login(): Promise<boolean> {
        return false;
    }
    async isLoggedIn(): Promise<boolean> {
        return false;
    }

    // async constructor
    async initialize(): Promise<void> {
        return;
    }

    async getFile(path: string): Promise<string | undefined> {
        return this.files[path];
    }
    
    async getDirectory(path: string): Promise<TDirectory | undefined> {
        return this.directories[path];
    }

    async getJSONFile<T>(path: string): Promise<T | undefined> {
        return JSON.parse(this.files[path]) as T;
    }

    async updateFile(path: string, contents: string): Promise<void> {
        this.files[path] = contents;
    }
    
    async updateJSON<T>(path: string, contents: T): Promise<void> {
        this.files[path] = JSON.stringify(contents);
    }
}