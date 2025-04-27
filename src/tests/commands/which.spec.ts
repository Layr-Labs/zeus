import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { canonicalPaths } from '../../metadata/paths';
import type { TState } from '../../commands/inject';
import { MockMetadataStore } from '../mockStorage';
import { mockUser } from '../mockData';

const ___originalInject = await import('../../commands/inject');
jest.unstable_mockModule('../../commands/inject', async () => {
  return {
    ...___originalInject,
    assertInRepo: jest.fn((user) => user),
    load: jest.fn<() => Promise<TState>>().mockResolvedValue(
      {
        zeusHostOwner: `layr-labs`,
        zeusHostRepo: `eigenlayer-contracts-zeus-metadata`,
        metadataStore: undefined,
        loggedOutMetadataStore: undefined,
        github: undefined,
        login: async () => {}
      }
    )
  }
});

const cmd = await import('../../commands/which');
// Note: we need to access the handler directly, not through default export

describe('which command', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
    jest.spyOn(console, 'table');
    jest.clearAllMocks();
  });

  it('should find contract by name in a specific environment', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {
            'Contract1': {
              address: '0x1234567890123456789012345678901234567890',
              deployedBytecodeHash: '0xhash1',
              deployer: '0xdeployer'
            }
          },
          instances: []
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {}
    });
    
    await cmd.handler(mockUser(mockStorage), {
      contractOrAddress: 'Contract1',
      env: 'mainnet',
      instance: 0
    });
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('0x1234567890123456789012345678901234567890')
    );
  });

  it('should find contract by name across all environments when no env is specified', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {
            'Contract1': {
              address: '0x1234567890123456789012345678901234567890',
              deployedBytecodeHash: '0xhash1',
              deployer: '0xdeployer'
            }
          },
          instances: []
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.environmentManifest('testnet')]: {
        id: 'testnet',
        chainId: 5,
        deployedVersion: '0.9.0',
        contracts: {
          static: {
            'Contract1': {
              address: '0x0987654321098765432109876543210987654321',
              deployedBytecodeHash: '0xhash2',
              deployer: '0xdeployer'
            }
          },
          instances: []
        },
        latestDeployedCommit: '0xdef456'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {},
      [canonicalPaths.deployParameters('', 'testnet')]: {}
    });
    
    await cmd.handler(mockUser(mockStorage), {
      contractOrAddress: 'Contract1',
      env: undefined,
      instance: 0
    });
    
    expect(console.table).toHaveBeenCalled();
  });

  it('should find contract by address', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {
            'Contract1': {
              address: '0x1234567890123456789012345678901234567890',
              deployedBytecodeHash: '0xhash1',
              deployer: '0xdeployer'
            }
          },
          instances: []
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.environmentManifest('testnet')]: {
        id: 'testnet',
        chainId: 5,
        deployedVersion: '0.9.0',
        contracts: {
          static: {
            'Contract2': {
              address: '0x0987654321098765432109876543210987654321',
              deployedBytecodeHash: '0xhash2',
              deployer: '0xdeployer'
            }
          },
          instances: []
        },
        latestDeployedCommit: '0xdef456'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {},
      [canonicalPaths.deployParameters('', 'testnet')]: {}
    });
    
    await cmd.handler(mockUser(mockStorage), {
      contractOrAddress: '0x1234567890123456789012345678901234567890',
      env: undefined,
      instance: 0
    });
    
    expect(console.table).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.arrayContaining(['mainnet', 'Contract1'])
      ])
    );
  });

  it('should handle case when contract is not found', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {},
          instances: []
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {}
    });
    
    await expect(
      cmd.handler(mockUser(mockStorage), {
        contractOrAddress: 'NonExistentContract',
        env: 'mainnet',
        instance: 0
      })
    ).rejects.toThrow('No such contract');
  });

  it('should handle contract instances', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {},
          instances: [
            {
              contract: 'ContractWithInstance',
              address: '0x1111111111111111111111111111111111111111',
              deployedBytecodeHash: '0xhash1',
              deployer: '0xdeployer'
            },
            {
              contract: 'ContractWithInstance',
              address: '0x2222222222222222222222222222222222222222',
              deployedBytecodeHash: '0xhash2',
              deployer: '0xdeployer'
            }
          ]
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {}
    });
    
    await cmd.handler(mockUser(mockStorage), {
      contractOrAddress: '0x2222222222222222222222222222222222222222',
      env: undefined,
      instance: 0
    });
    
    expect(console.table).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.arrayContaining(['mainnet', 'ContractWithInstance_1'])
      ])
    );
  });

  it('should handle no matches for address search', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {
          static: {},
          instances: []
        },
        latestDeployedCommit: '0xabc123'
      },
      [canonicalPaths.deployParameters('', 'mainnet')]: {}
    });
    
    await cmd.handler(mockUser(mockStorage), {
      contractOrAddress: '0x9999999999999999999999999999999999999999',
      env: undefined,
      instance: 0
    });
    
    expect(console.error).toHaveBeenCalledWith('<no matches>');
  });
});