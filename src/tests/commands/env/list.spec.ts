import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { mockUser } from '../../mockData';
import { goerli, mainnet } from 'viem/chains';

const ___originalInject = await import('../../../commands/inject');
jest.unstable_mockModule('../../../commands/inject', async () => {
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

const cmd = await import('../../../commands/env/cmd/list');

describe('env list command', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'table');
    jest.clearAllMocks();
  });

  it('should handle no environments', async () => {
    const mockStorage = new MockMetadataStore({});
    await cmd.handler(mockUser(mockStorage), {json: undefined});
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('No environments yet')
    );
  });

  it('should list environments when available', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: mainnet.id,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0'
      },
      [canonicalPaths.environmentManifest('testnet')]: {
        id: 'testnet',
        chainId: goerli.id,
        deployedVersion: '0.9.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0'
      }
    });
    
    await cmd.handler(mockUser(mockStorage), {json: undefined});
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 environments')
    );
    expect(console.table).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'mainnet',
          version: '1.0.0',
          chain: mainnet.name
        }),
        expect.objectContaining({
          name: 'testnet',
          version: '0.9.0',
          chain: goerli.name
        })
      ])
    );
  });

  it('should output JSON when json flag is used', async () => {
    const mockStorage = new MockMetadataStore({
      'environment': null,
      'environment/mainnet': null,
      'environment/testnet': null
    });
    
    await cmd.handler(mockUser(mockStorage), {json: true});
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[.*\]/)
    );
  });
});