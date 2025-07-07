import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { envTestnet, mockUser, upgradeOne, upgradeTwo } from '../../mockData';
import { TEnvironmentManifest, TUpgrade } from '../../../metadata/schema';

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

  it('should filter upgrades based on environment version including prereleases', async () => {
    const envWithPrerelease: TEnvironmentManifest = {
      id: 'preprod',
      chainId: 1,
      deployedVersion: '1.7.0-rc.0',
      contracts: {static: {}, instances: []},
      latestDeployedCommit: '0'
    };

    const upgradeForPrerelease: TUpgrade = {
      name: "redistribution",
      from: '>=1.3.0',
      to: '1.7.1',
      phases: [],
      commit: '0x123'
    };

    const upgradeNotMatching: TUpgrade = {
      name: "future-upgrade",
      from: '>=2.0.0',
      to: '2.1.0',
      phases: [],
      commit: '0x456'
    };

    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('preprod')]: envWithPrerelease,
      [canonicalPaths.upgradeManifest('redistribution')]: upgradeForPrerelease,
      [canonicalPaths.upgradeManifest('future-upgrade')]: upgradeNotMatching,
    });

    await cmd.handler(mockUser(mockStorage), {env: 'preprod'});
    
    // Should show the upgrade that matches the prerelease version
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('redistribution'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('>=1.3.0'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1.7.1'));
    
    // Should not show the upgrade that doesn't match
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('future-upgrade'));
  });
});