import { configs } from '../commands/inject.js';
import {login} from './github.js';

export interface MetadataStore {
    environment?: string;
    repo?: string;

    login(): Promise<boolean>;
    isLoggedIn(): Promise<boolean>;

    // async constructor
    initialize(): Promise<void>;

    getPath(path: string): Promise<string>;
    getJSONPath<T>(path: string): Promise<T>;
    updatePath(path: string, contents: string): Promise<string>;
};
