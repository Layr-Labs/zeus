import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { TState } from '../../../commands/inject';
import type { TDeploy, TDeployedContractsManifest } from '../../../metadata/schema';
import { canonicalPaths } from '../../../metadata/paths';

const prepareMock = jest.fn();

jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn(),
}));

jest.unstable_mockModule('ora', () => ({
  default: jest.fn(() => ({
    start: jest.fn(),
    stopAndPersist: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../../commands/prompts', () => ({
  rpcUrl: jest.fn(async () => 'http://localhost'),
}));

jest.unstable_mockModule('../../../commands/deploy/cmd/utils', () => ({
  getActiveDeploy: jest.fn(),
}));

jest.unstable_mockModule('../../../commands/env/cmd/list', () => ({
  loadExistingEnvs: jest.fn(async () => [{ name: 'mainnet' }]),
}));

jest.unstable_mockModule('../../../commands/inject', () => ({
  assertInRepo: (u: unknown) => u,
  withHost: jest.fn(),
  requires: jest.fn((handler: unknown) => handler),
}));

jest.unstable_mockModule('../../../signing/strategies/gnosis/api/gnosisEoa', () => ({
  GnosisEOAApiStrategy: class {
    prepare = prepareMock;
    constructor(..._args: unknown[]) {}
  },
}));

const verifyMod = await import('../../../commands/deploy/cmd/verify');
const utilsMod = await import('../../../commands/deploy/cmd/utils');

describe('deploy verify - continue on failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prepareMock.mockResolvedValue({ safeTxHash: '0xbbb' });
  });

  const buildUser = (getJSONFile: (path: string) => Promise<{ _: unknown }>): TState => ({
    zeusHostOwner: 'owner',
    zeusHostRepo: 'repo',
    metadataStore: {} as any,
    loggedOutMetadataStore: {
      begin: async () => ({ getJSONFile }),
    } as any,
    github: {} as any,
    login: async () => {},
  });

  const buildDeploy = (): TDeploy => ({
    name: 'deploy-1',
    env: 'mainnet',
    upgrade: 'upgrade-1',
    chainId: 1,
    upgradePath: 'upgrade/upgrade-1',
    phase: 'multisig',
    segmentId: 1,
    segments: [
      { id: 0, type: 'multisig', filename: 'step-1.s.sol' },
      { id: 1, type: 'multisig', filename: 'step-2.s.sol' },
    ],
    metadata: [],
    startTime: new Date().toString(),
    startTimestamp: Math.floor(Date.now() / 1000),
  });

  const deployedContracts: TDeployedContractsManifest = {
    contracts: [
      {
        singleton: true,
        contract: 'Example',
        address: '0x0000000000000000000000000000000000000001',
        deployedBytecodeHash: '0x01',
        lastUpdatedIn: {
          name: 'deploy-1',
          phase: 'multisig',
          segment: 0,
          signer: '0x0000000000000000000000000000000000000001',
        },
      },
    ],
  };

  it('continues to the next step when --continue-on-failure is true', async () => {
    const deploy = buildDeploy();
    (utilsMod as any).getActiveDeploy.mockResolvedValue({ _: deploy });

    const deployedContractsPath = canonicalPaths.deployDeployedContracts(deploy);
    const multisigRunPath0 = canonicalPaths.multisigRun({
      deployEnv: deploy.env,
      deployName: deploy.name,
      segmentId: 0,
    });
    const multisigRunPath1 = canonicalPaths.multisigRun({
      deployEnv: deploy.env,
      deployName: deploy.name,
      segmentId: 1,
    });

    let multisigCalls = 0;
    const getJSONFile = jest.fn(async (path: string) => {
      if (path === deployedContractsPath) {
        return { _: deployedContracts };
      }
      if (path === multisigRunPath0) {
        multisigCalls += 1;
        return { _: { safeTxHash: '0xaaa', senderAddress: '0x0000000000000000000000000000000000000001' } };
      }
      if (path === multisigRunPath1) {
        multisigCalls += 1;
        return { _: { safeTxHash: undefined, senderAddress: '0x0000000000000000000000000000000000000001' } };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const user = buildUser(getJSONFile);

    await expect(
      verifyMod.handler(user, { env: deploy.env, deploy: undefined, continueOnFailure: true })
    ).resolves.toBeUndefined();

    expect(multisigCalls).toBe(2);
    expect(prepareMock).toHaveBeenCalledTimes(1);
  });

  it('throws on the first failing step when --continue-on-failure is false', async () => {
    const deploy = buildDeploy();
    (utilsMod as any).getActiveDeploy.mockResolvedValue({ _: deploy });

    const deployedContractsPath = canonicalPaths.deployDeployedContracts(deploy);
    const multisigRunPath0 = canonicalPaths.multisigRun({
      deployEnv: deploy.env,
      deployName: deploy.name,
      segmentId: 0,
    });
    const multisigRunPath1 = canonicalPaths.multisigRun({
      deployEnv: deploy.env,
      deployName: deploy.name,
      segmentId: 1,
    });

    let multisigCalls = 0;
    const getJSONFile = jest.fn(async (path: string) => {
      if (path === deployedContractsPath) {
        return { _: deployedContracts };
      }
      if (path === multisigRunPath0) {
        multisigCalls += 1;
        return { _: { safeTxHash: '0xaaa', senderAddress: '0x0000000000000000000000000000000000000001' } };
      }
      if (path === multisigRunPath1) {
        multisigCalls += 1;
        return { _: { safeTxHash: '0xaaa', senderAddress: '0x0000000000000000000000000000000000000001' } };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const user = buildUser(getJSONFile);

    await expect(
      verifyMod.handler(user, { env: deploy.env, deploy: undefined, continueOnFailure: false })
    ).rejects.toThrow('multisig transaction did not match');

    expect(multisigCalls).toBe(1);
  });
});
