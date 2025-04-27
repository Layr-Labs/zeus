import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { envTestnet, mockUser, upgradeOne, upgradeTwo } from '../../mockData';

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

const cmd = await import('../../../commands/upgrade/cmd/list');

describe('upgrade list command', () => {

  beforeEach(async () => {
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');

    jest.clearAllMocks();

  });

  it('should handle no upgrades registered', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('testnet')]: envTestnet
    })
    await cmd.handler(mockUser(mockStorage), {env: undefined});

    // Verify error message
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No upgrades have been registered')
    );
  });

  it('should list all upgrades when no environment is specified', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('testnet')]: envTestnet,
      [canonicalPaths.upgradeManifest('upgrade-1')]: upgradeOne,
      [canonicalPaths.upgradeManifest('upgrade-2')]: upgradeTwo,
    })

    await cmd.handler(mockUser(mockStorage), {env: 'testnet'});
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('upgrade-1'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('upgrade one'));
    
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('upgrade-2'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('upgrade two'));
  });
});