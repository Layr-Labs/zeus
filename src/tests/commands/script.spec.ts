import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { canonicalPaths } from '../../metadata/paths';
import type { TState } from '../../commands/inject';
import { MockMetadataStore } from '../mockStorage';
import { mockUser } from '../mockData';
import fs from 'fs';
import { SavebleDocument } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';

type TStepDeploy = (deploy: SavebleDocument<TDeploy>) => Promise<void>;
jest.unstable_mockModule('../../commands/deploy/cmd/run', () => ({
  stepDeploy: jest.fn<TStepDeploy>().mockImplementation(async (deploy: SavebleDocument<TDeploy>) => {
    deploy._.phase = 'complete';
    return;
  }),
}));

const metadataStore = new MockMetadataStore({});

const ___originalInject = await import('../../commands/inject');
jest.unstable_mockModule('../../commands/inject', async () => {
  return {
    ...___originalInject,
    withHost: jest.fn(),
    load: jest.fn<() => Promise<TState>>().mockResolvedValue({
      zeusHostOwner: `layr-labs`,
      zeusHostRepo: `eigenlayer-contracts-zeus-metadata`,
      metadataStore: metadataStore,
      loggedOutMetadataStore: metadataStore,
      github: undefined,
      login: async () => {}
    })
  }
});


const cmd = await import('../../commands/script');
const deployCmdRun = await import('../../commands/deploy/cmd/run');

describe('script command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
    jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    jest.spyOn(fs, 'existsSync');

    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should execute script successfully with EOA strategy', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0'
      }
    });
    
    // Call the handler with script arguments for EOA
    await cmd.handler(mockUser(mockStorage), {
      scripts: ['/path/to/script.sol'],
      env: 'mainnet',
      multisig: false,
      eoa: true,
      json: false
    });
    
    // Verify stepDeploy was called
    expect(deployCmdRun.stepDeploy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Running script'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should execute script successfully with multisig strategy', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0'
      }
    });
    
    const mockUserState = {
      ...mockUser(mockStorage),
      loggedOutMetadataStore: mockStorage
    };
    
    await cmd.handler(mockUserState, {
      scripts: ['/path/to/script.sol'],
      env: 'mainnet',
      multisig: true,
      eoa: false,
      json: false
    });
    
    // Verify it called stepDeploy with the right starting phase
    const deployDocCaptured = (deployCmdRun.stepDeploy as jest.Mock).mock.calls[0][0] as SavebleDocument<TDeploy>;
    expect(deployDocCaptured._.phase).toEqual('complete'); // phase was set to complete by our mock
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Running script'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should handle script execution failure', async () => {
    const mockStorage = new MockMetadataStore({
      [canonicalPaths.environmentManifest('mainnet')]: {
        id: 'mainnet',
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: {static: {}, instances: []},
        latestDeployedCommit: '0'
      }
    });
    
    const mockUserState = {
      ...mockUser(mockStorage),
      loggedOutMetadataStore: mockStorage
    };
  
    // Mock stepDeploy to throw an error
    (deployCmdRun.stepDeploy as jest.Mock<typeof deployCmdRun.stepDeploy>).mockRejectedValueOnce(new Error('Script execution failed'));
    
    // Call the handler with script arguments
    await cmd.handler(mockUserState, {
      scripts: ['/path/to/script.sol'],
      env: 'mainnet',
      multisig: false,
      eoa: true,
      json: false
    });
    
    // Verify error handling
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Script execution failed'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should validate script existence', async () => {
    const mockStorage = new MockMetadataStore({});
    const mockUserState = mockUser(mockStorage);
    
    // Mock script file not existing
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await cmd.handler(mockUserState, {
      scripts: ['/path/to/nonexistent.sol'],
      env: 'mainnet',
      multisig: false,
      eoa: true,
      json: false
    });
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Script not found'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should validate environment existence', async () => {
    const mockStorage = new MockMetadataStore({});
    
    const mockUserState = {
      ...mockUser(mockStorage),
      loggedOutMetadataStore: mockStorage
    };
    
    await cmd.handler(mockUserState, {
      scripts: ['/path/to/script.sol'],
      env: 'nonexistent',  // This environment doesn't exist
      multisig: false,
      eoa: true,
      json: false
    });
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No such environment'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should require exactly one script', async () => {
    const mockStorage = new MockMetadataStore({});
    const mockUserState = mockUser(mockStorage);
    
    await cmd.handler(mockUserState, {
      scripts: ['/path/to/script1.sol', '/path/to/script2.sol'],  // Multiple scripts
      env: 'mainnet',
      multisig: false,
      eoa: true,
      json: false
    });
    
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Exactly one script must be specified'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});