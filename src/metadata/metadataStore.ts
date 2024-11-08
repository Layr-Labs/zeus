export type TDirectory = {
    type: 'dir' | 'file' | unknown;
    name: string;
}[];

export interface SavebleDocument<T> {
    // latest server-ack'ed contents of the file.
    contents: string;

    path: string;
    save(): Promise<void>;

    // indicate that the file contents were updated out-of-band from this file's save method.
    wasSavedOptimistically(): void;

    // if you were to save right now, what contents would be written?
    pendingSaveableContents(): string;

    // whether there are unsaved changes.
    dirty: boolean;

    // whether the local saved copy has been pushed to the remote.
    upToDate: boolean; 

    // the contents, that you will typically modify when making changes.
    // SaveableDocument is a wrapper around this, meant to be used like;
    //
    //  `doc._.myField = 1`
    //  `doc.save()`
    _: T; 
}

export interface Transaction {
    // loads from the same atomic point.
    getFile(path: string): Promise<SavebleDocument<string>>;
    getDirectory(path: string): Promise<TDirectory>;
    getJSONFile<T extends object>(path: string): Promise<SavebleDocument<T>>;

    // attempts to commit changes to any of the files previously obtained from `getFile/getJSONFile`.
    // NOTE: making changes without `commit()` will do nothing.
    commit(log: string): Promise<void>;
    hasChanges(): boolean; // whether committing will do anything.
}

export interface MetadataStore {
    login(): Promise<boolean>;
    isLoggedIn(): Promise<boolean>;

    // async constructor
    initialize(): Promise<void>;

    begin(options?: {verbose?: boolean}): Promise<Transaction>;
};
