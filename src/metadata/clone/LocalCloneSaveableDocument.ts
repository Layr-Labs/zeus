import { SavebleDocument } from "../metadataStore";

// -------------------------------------------------------
// LocalSavebleDocument
// -------------------------------------------------------
export class LocalSavebleDocument<T> implements SavebleDocument<T> {
    contents: string;
    path: string;
    _: T;
    // read-only version: no changes allowed, so dirty/upToDate are static.
    dirty = false;
    upToDate = true;

    constructor(filePath: string, contents: string, parsedContents: T) {
        this.path = filePath;
        this.contents = contents;
        this._ = parsedContents;
    }

    save(): Promise<void> {
        // In a read-only implementation, saving is not allowed.
        return Promise.reject(new Error('This store is read-only. Cannot save.'));
    }

    wasSavedOptimistically(): void {
        // In a read-only implementation, this is a no-op.
    }

    pendingSaveableContents(): string {
        // Since we never change anything, pending = current.
        return this.contents;
    }
}