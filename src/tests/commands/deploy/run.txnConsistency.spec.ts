import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { canonicalPaths } from '../../../metadata/paths';
import { MockMetadataStore } from '../../mockStorage';
import type { TState } from '../../../commands/inject';
import type { Transaction } from '../../../metadata/metadataStore';
import type { SavebleDocument } from '../../../metadata/metadataStore';
import type { TDeploy } from '../../../metadata/schema';
import { HaltDeployError } from '../../../signing/strategy';

// We'll stub configs after importing the module instead of full module mocking

// Capture the txn passed to acquireDeployLock and the txn used when stepping
let capturedTxnFromLock: Transaction | undefined;
let capturedTxnFromStep: Transaction | undefined;

jest.unstable_mockModule('../../../commands/deploy/cmd/utils-locks', () => ({
  acquireDeployLock: jest.fn(async (_deploy: TDeploy, txn: Transaction) => {
    capturedTxnFromLock = txn;
    return true;
  }),
  releaseDeployLock: jest.fn(async () => { /* no-op */ }),
}));

// Capture the txn used by the script phase (stepDeploy routes here when phase is 'script_run')
jest.unstable_mockModule('../../../deploy/handlers/script', () => ({
  executeScriptPhase: jest.fn(async (_deploy: SavebleDocument<TDeploy>, metatxn: Transaction) => {
    capturedTxnFromStep = metatxn;
    // Exit the run loop immediately
    throw new HaltDeployError(_deploy, 'complete', true);
  }),
}));

// Import after mocks are set up
const runMod = await import('../../../commands/deploy/cmd/run');
const configsMod = await import('../../../commands/configs');

describe('deploy run - uses same txn for lock and step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedTxnFromLock = undefined;
    // Stub configs methods used by handler
    jest.spyOn(configsMod.configs.zeus, 'load').mockResolvedValue({
      zeusHost: 'https://example.com/owner/repo',
      migrationDirectory: 'migrations',
    } as any);
    jest.spyOn(configsMod.configs.zeus, 'dirname').mockResolvedValue('');
    jest.spyOn(configsMod.configs.zeus, 'path').mockResolvedValue('');
    jest.spyOn(configsMod.configs.zeusProfile, 'load').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ensures the same Transaction instance is used for lock and next step', async () => {
    const env = 'mainnet';
    const deployName = 'testDeploy';

    const deployPath = canonicalPaths.deployStatus({ env, name: deployName });
    const envManifestPath = canonicalPaths.environmentManifest(env);
    const deploysManifestPath = canonicalPaths.deploysManifest(env);
    const lockPath = canonicalPaths.deployLock({ env } as any);

    const mockStore = new MockMetadataStore({
      [envManifestPath]: {
        id: env,
        chainId: 1,
        deployedVersion: '1.0.0',
        contracts: { static: {}, instances: [] },
        latestDeployedCommit: '0x0'
      },
      [deploysManifestPath]: {
        inProgressDeploy: deployName,
      },
      [deployPath]: {
        name: deployName,
        env,
        upgrade: 'upgrade-x',
        chainId: 1,
        upgradePath: 'upgrade/upgrade-x',
        phase: 'script_run',
        segmentId: 0,
        segments: [ { id: 0, type: 'script', filename: 'script.s.sol' } ],
        metadata: [],
        startTime: new Date().toString(),
        startTimestamp: Math.floor(Date.now() / 1000),
      } as TDeploy,
      [lockPath]: { },
    });

    const user: TState = {
      zeusHostOwner: 'owner',
      zeusHostRepo: 'repo',
      metadataStore: mockStore,
      loggedOutMetadataStore: mockStore,
      github: {} as any,
      login: async () => {}
    };

    await runMod.handler(user, {
      env,
      resume: true,
      rpcUrl: undefined,
      json: false,
      upgrade: undefined,
      nonInteractive: undefined,
      fork: undefined,
    });

    expect(capturedTxnFromLock).toBeDefined();
    expect(capturedTxnFromStep).toBeDefined();
    expect(capturedTxnFromStep).toBe(capturedTxnFromLock);
  });
});


