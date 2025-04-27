import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { mockUser } from '../../mockData';
import { TDirectory } from '../../../metadata/metadataStore';
import { TEnvironmentManifest } from '../../../metadata/schema';

// Mock dependencies
jest.unstable_mockModule('../../../commands/utils', () => ({
  question: jest.fn(),
  select: jest.fn(),
}));

// Import mocked utils
const utils = await import('../../../commands/utils');
const questionMock = utils.question as jest.MockedFunction<typeof utils.question>;
const selectMock = utils.select as jest.MockedFunction<typeof utils.select>;

// Mock command-specific dependencies
const ___originalInject = await import('../../../commands/inject');
jest.unstable_mockModule('../../../commands/inject', async () => {
  return {
    ...___originalInject,
    assertLoggedIn: jest.fn((user) => user),
    load: jest.fn<() => Promise<TState>>().mockResolvedValue({
      zeusHostOwner: `layr-labs`,
      zeusHostRepo: `eigenlayer-contracts-zeus-metadata`,
      metadataStore: undefined,
      loggedOutMetadataStore: undefined,
      github: undefined,
      login: async () => {}
    }),
    loggedIn: jest.fn(),
    withHost: jest.fn(),
  }
});

type TLoadExistingEnvs = () => Promise<TDirectory[]>;

// Mock the list module that's used by new.ts
jest.unstable_mockModule('../../../commands/env/cmd/list', async () => {
  return {
    loadExistingEnvs: jest.fn<TLoadExistingEnvs>().mockResolvedValue([]),
    handler: jest.fn(),
    default: { handler: jest.fn() }
  }
});

const cmd = await import('../../../commands/env/cmd/new');

describe('env new command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
    
    // Set up question mock responses
    questionMock
      .mockResolvedValueOnce('my-new-env') // Environment name
      .mockResolvedValueOnce('42'); // Custom chain ID (if needed)
    
    // Set up select mock response for chain
    selectMock.mockResolvedValueOnce(1); // Selecting Mainnet (0x1)
  });

  it('should create a new environment successfully', async () => {
    // Create a mock storage with a commit function that always succeeds
    const mockStorage = new MockMetadataStore({});
    
    const mockUserState = mockUser(mockStorage);
    
    await cmd.handler(mockUserState);
    
    // Check that the environment manifest path was used
    const mockTransaction = await mockStorage.begin();
    expect(mockTransaction.getJSONFile).toHaveBeenCalledWith(
      canonicalPaths.environmentManifest('my-new-env')
    );
    expect(mockTransaction.getJSONFile).toHaveBeenCalledWith(
      canonicalPaths.deploysManifest('my-new-env')
    );
    expect(mockTransaction.commit).toHaveBeenCalledWith(
      expect.stringContaining('Created environment: my-new-env')
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('created environment'));
  });

  it('should handle custom chain IDs correctly', async () => {
    // Override the select mock to choose Custom chain
    selectMock.mockReset();
    selectMock.mockResolvedValueOnce(0); // Selecting Custom (0x0)
    
    questionMock.mockReset();
    questionMock.mockResolvedValueOnce('my-new-env');
    questionMock.mockResolvedValueOnce('42');

    const mockStorage = new MockMetadataStore({});
    await cmd.handler(mockUser(mockStorage));
    
    // Verify the custom chain ID was used (should be 42 from the question mock)
    const txn = await mockStorage.begin();
    const envManifestFile = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest('my-new-env'));
    
    expect(envManifestFile.save).toHaveBeenCalled();
    expect(txn.commit).toHaveBeenCalled();
    expect(envManifestFile._.chainId).toEqual(42);
  });

  it('should handle transaction commit errors', async () => {
    const mockStorage = new MockMetadataStore({});
    const mockUserState = mockUser(mockStorage);

    const txn = await mockStorage.begin();
    (txn.commit as jest.Mock<typeof txn.commit>).mockRejectedValueOnce(new Error('ruh roh'));
    
    // The handler should throw an error when commit fails
    await expect(cmd.handler(mockUserState))
      .rejects.toThrow('Failed to create environment folder');
  });
});