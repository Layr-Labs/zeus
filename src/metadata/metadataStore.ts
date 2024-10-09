export type TDirectory = {
    type: string;
    name: string;
}[];

export interface MetadataStore {
    environment?: string;
    repo?: string;

    login(): Promise<boolean>;
    isLoggedIn(): Promise<boolean>;

    // async constructor
    initialize(): Promise<void>;

    getFile(path: string): Promise<string>;
    getDirectory(path: string): Promise<TDirectory | undefined>;
    getJSONFile<T>(path: string): Promise<T>;
    updateFile(path: string, contents: string): Promise<string>;
};
