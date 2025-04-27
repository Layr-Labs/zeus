import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { mockUser } from '../../mockData';

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

// Mock the run module for injectableEnvForEnvironment
jest.unstable_mockModule('../../../commands/run', async () => {
  return {
    injectableEnvForEnvironment: jest.fn(async (txn, env, withDeploy) => {
      if (env === 'mainnet') {
        return {
          ZEUS_ENV: 'mainnet',
          ZEUS_ENV_COMMIT: '0xabc123',
          ZEUS_ENV_VERSION: '1.0.0',
          ZEUS_VERSION: '0.1.0',
          ZEUS_ENV_CHAIN_ID: '1',
          ZEUS_DEPLOYED_Contract1: '0x1234567890abcdef',
          ZEUS_DEPLOYED_Contract2: '0xabcdef1234567890'
        };
      } else if (env === 'testnet') {
        return {
          ZEUS_ENV: 'testnet',
          ZEUS_ENV_COMMIT: '0xdef456',
          ZEUS_ENV_VERSION: '0.9.0',
          ZEUS_VERSION: '0.1.0',
          ZEUS_ENV_CHAIN_ID: '5',
          ZEUS_DEPLOYED_TestContract: '0x0987654321fedcba'
        };
      }
      return {
        ZEUS_ENV: env,
        ZEUS_ENV_COMMIT: '0x0',
        ZEUS_ENV_VERSION: '0.0.0',
        ZEUS_VERSION: '0.1.0'
      };
    })
  };
});

// Mock getActiveDeploy
jest.unstable_mockModule('../../../commands/deploy/cmd/utils', async () => {
  return {
    getActiveDeploy: jest.fn(async (txn, env) => {
      if (env === 'mainnet') {
        return {
          _: {
            name: 'deploy-1',
            status: 'active',
            upgrade: 'upgrade-1'
          }
        };
      }
      return undefined;
    })
  };
});

const cmd = await import('../../../commands/env/cmd/show');
// Note: we need to access the handler directly, not through default export

describe('env show command', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
    jest.spyOn(console, 'table');
    jest.clearAllMocks();
  });

  it('should error when environment does not exist', async () => {
    const mockStorage = new MockMetadataStore({});
    await cmd.handler(mockUser(mockStorage), {
      json: undefined,
      env: 'nonexistent',
      pending: false
    });
    
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No such environment')
    );
  });

  it('should display environment details when environment exists', async () => {
    const mockStorage = new MockMetadataStore({
      'environment': null,
      'environment/mainnet': null,
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0xabc123'
      }
    });
    
    await cmd.handler(mockUser(mockStorage), {
      json: undefined,
      env: 'mainnet',
      pending: false
    });
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Environment Parameters')
    );
    expect(console.table).toHaveBeenCalled();
  });

  it('should output JSON when json flag is used', async () => {
    const mockStorage = new MockMetadataStore({
      'environment': null,
      'environment/testnet': null,
      [canonicalPaths.environmentManifest('testnet')]: {
        id: 'testnet',
        chainId: 5,
        deployedVersion: '0.9.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0xdef456'
      }
    });
    
    await cmd.handler(mockUser(mockStorage), {
      json: true,
      env: 'testnet',
      pending: false
    });
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\{.*\}/)
    );
  });

  it('should show pending changes when pending flag is used', async () => {
    const mockStorage = new MockMetadataStore({
      'environment': null,
      'environment/mainnet': null,
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0xabc123'
      }
    });
    
    await cmd.handler(mockUser(mockStorage), {
      json: undefined,
      env: 'mainnet',
      pending: true
    });
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Environment Parameters')
    );
    expect(console.table).toHaveBeenCalled();
  });
});