import { jest } from '@jest/globals';
import { SavebleDocument, TDirectory, Transaction } from '../../metadata/metadataStore';

/**
 * Creates a properly typed mock for SavebleDocument
 */
export function createMockSaveableDocument<T extends object>(data: T): SavebleDocument<T> {
  return {
    _: data,
    contents: JSON.stringify(data),
    path: '/mock/path',
    save: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    wasSavedOptimistically: jest.fn(),
    pendingSaveableContents: jest.fn().mockReturnValue(JSON.stringify(data)),
    dirty: false,
    upToDate: true
  };
}

/**
 * Creates a properly typed mock Transaction
 */
export function createMockTransaction(): Transaction {
  const files = new Map<string, SavebleDocument<any>>();
  
  const transaction: Transaction = {
    getJSONFile: jest.fn<Transaction['getJSONFile']>().mockImplementation(
      async <T extends object>(path: string): Promise<SavebleDocument<T>> => {
        if (files.has(path)) {
          return files.get(path) as SavebleDocument<T>;
        }
        const doc = createMockSaveableDocument<T>({} as T);
        files.set(path, doc);
        return doc;
      }
    ),
    
    getDirectory: jest.fn<Transaction['getDirectory']>().mockResolvedValue([]),
    
    commit: jest.fn<Transaction['commit']>().mockResolvedValue(undefined),
    
    hasChanges: jest.fn<Transaction['hasChanges']>().mockReturnValue(false)
  };
  
  return transaction;
}

/**
 * Sets up a mock directory listing for a transaction
 */
export function mockDirectoryListing(
  transaction: Transaction, 
  path: string, 
  entries: { type: 'dir' | 'file' | unknown; name: string }[]
): void {
  (transaction.getDirectory as jest.Mock).mockImplementation(
    async (requestPath: string): Promise<TDirectory> => {
      if (requestPath === path) {
        return entries;
      }
      return [];
    }
  );
}

/**
 * Sets up a mock JSON file for a transaction
 */
export function mockJSONFile<T extends object>(
  transaction: Transaction,
  path: string,
  data: T
): SavebleDocument<T> {
  const doc = createMockSaveableDocument(data);
  (transaction.getJSONFile as jest.Mock).mockImplementation(
    async <U extends object>(requestPath: string): Promise<SavebleDocument<U>> => {
      if (requestPath === path) {
        return doc as unknown as SavebleDocument<U>;
      }
      return createMockSaveableDocument<U>({} as U);
    }
  );
  return doc;
}