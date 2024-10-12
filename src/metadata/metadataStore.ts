export type TDirectory = {
    type: string;
    name: string;
}[];

export interface MetadataStore {
    login(): Promise<boolean>;
    isLoggedIn(): Promise<boolean>;

    // async constructor
    initialize(): Promise<void>;

    getFile(path: string): Promise<string | undefined>;
    getDirectory(path: string): Promise<TDirectory | undefined>;
    getJSONFile<T>(path: string): Promise<T | undefined>;

    updateFile(path: string, contents: string): Promise<void>;
    updateJSON<T>(path: string, contents: T): Promise<void>;
};
