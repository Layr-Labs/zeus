import { jest } from '@jest/globals';
import { MockStrategy } from './mockStrategy';
import { TDeployPhase, TEnvironmentManifest } from '../../metadata/schema';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

jest.unstable_mockModule('@celo/viem-account-ledger', () => ({
    // replace ledger with a hardcoded account
    ledgerToAccount: jest.fn().mockReturnValue(privateKeyToAccount(generatePrivateKey()))
}))

export function mockEnvManifest(): TEnvironmentManifest {
  return {
      id: "testenv",
      chainId: 17000,
      deployedVersion: "1.0.0",
      contracts: {
          static: {
            "SampleContract_Impl": {
              deployedBytecodeHash: `0x123`,
              lastUpdatedIn: {name: '', phase: 'multisig_start', segment: 0},
              singleton: true,
              contract: `SampleContract`,
              address: `0xabc`
            },
            "SampleContract_Proxy": {
              deployedBytecodeHash: `0x456`,
              lastUpdatedIn: {name: '', phase: 'multisig_start', segment: 0},
              singleton: true,
              contract: `SampleContract`,
              address: `0xdef`
            }
          },
          instances: [
            {
              deployedBytecodeHash: `0x456`,
              lastUpdatedIn: {name: '', phase: 'multisig_start', segment: 0},
              singleton: false,
              contract: `SampleContract`,
              address: `0xafd`
            }
          ],
      },
      latestDeployedCommit: `abcd`
  }
}

// A convenient helper to build minimal mocks for SavebleDocument and Transaction
export function mockDeployDocument<T>(phase: TDeployPhase, filename = 'testSegment.s.sol'): SavebleDocument<T> {
  return {
    _: {
      phase,
      segmentId: 0,
      upgradePath: 'src/tests/example',
      env: 'testEnv',
      name: 'testDeploy',
      chainId: 1,
      segments: [
        {
          filename,
          type: 'eoa'
        }
      ],
      metadata: {
        0: {},
        1: {},
      }
    },
    save: jest.fn()
  } as unknown as SavebleDocument<T>;
}

export function mockTransaction(files?: Record<string, unknown>): Transaction {
  return {
    commit: jest.fn<Transaction['commit']>(),
    getJSONFile: jest.fn<Transaction['getJSONFile']>().mockImplementation(async <T>(_path: string) => {
      return {
        _: (files ? files[_path] : {}) ?? {},
        save: jest.fn()
      } as unknown as SavebleDocument<T>;
    }),
    getFile: jest.fn<Transaction['getFile']>().mockImplementation(async <T>(_path: string) => {
      return {
        _: JSON.stringify((files ? files[_path] : {}) ?? {}),
        save: jest.fn()
      }  as unknown as SavebleDocument<T>;
    }),
    getDirectory: jest.fn<Transaction['getDirectory']>().mockImplementation(async (_path: string) => {
      return Object.keys(files ?? []).map(filePath => ({type: 'file', name: filePath}))
    }),
    hasChanges: jest.fn<Transaction['hasChanges']>().mockImplementation(() => {
      return false;
    })
  } as Transaction;
}


export function mockStatefulTransaction(files?: Record<string, unknown>): Transaction {
  const cachedFiles: Record<string, SavebleDocument<unknown>> = {};

  return {
    commit: jest.fn<Transaction['commit']>(),
    getJSONFile: jest.fn<Transaction['getJSONFile']>().mockImplementation(async <T>(_path: string) => {
      if (cachedFiles[_path] !== undefined) {
        return cachedFiles[_path] as unknown as SavebleDocument<T>;
      }
      const f = {
        _: (files ? files[_path] : {}) ?? {},
        save: jest.fn()
      } as unknown as SavebleDocument<T>;
      cachedFiles[_path] = f;
      return f;
    }),
    getFile: jest.fn<Transaction['getFile']>().mockImplementation(async <T>(_path: string) => {
      if (cachedFiles[_path] !== undefined) {
        return cachedFiles[_path] as unknown as SavebleDocument<T>;
      }
      const f = {
        _: JSON.stringify((files ? files[_path] : {}) ?? {}),
        save: jest.fn()
      }  as unknown as SavebleDocument<T>;
      cachedFiles[_path] = f;
      return f;
    }),
    getDirectory: jest.fn<Transaction['getDirectory']>().mockImplementation(async (_path: string) => {
      return Object.keys(files ?? []).map(filePath => ({type: 'file', name: filePath}))
    }),
    hasChanges: jest.fn<Transaction['hasChanges']>().mockImplementation(() => {
      return false;
    })
  } as Transaction;
}

await jest.unstable_mockModule('../../signing/strategies/test', async () => ({
  runTest: jest.fn()
}))
export const {runTest} = await import('../../signing/strategies/test');

const oldPrompts = await import('../../commands/prompts')
await jest.unstable_mockModule('../../commands/prompts', async () => ({
  ...oldPrompts,
  checkShouldSignGnosisMessage: jest.fn<() => Promise<boolean>>(async () => true),
  pickStrategy: jest.fn<() => Promise<string>>().mockResolvedValue(`ledger`),
  pressAnyButtonToContinue: jest.fn(),
  rpcUrl: jest.fn<() => Promise<string>>().mockResolvedValue("https://google.com"),
  privateKey: jest.fn<() => Promise<string>>().mockResolvedValue(`0x0`),
  wouldYouLikeToContinue: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  envVarOrPrompt: jest.fn<() => Promise<string>>().mockResolvedValue(""),
  etherscanApiKey: jest.fn<typeof oldPrompts['etherscanApiKey']>().mockResolvedValue(false)
}));

const utilsOld = await import('../../commands/deploy/cmd/utils');
await jest.unstable_mockModule('../../commands/deploy/cmd/utils', async () => ({
  ...utilsOld,
  sleepMs: () => {},
}));

await jest.unstable_mockModule(`../../signing/strategies/eoa/ledger`, async () => ({
  LedgerSigningStrategy: MockStrategy
}))

jest.unstable_mockModule('viem', () => ({
  ...jest.requireActual<typeof import('viem')>('viem'),
  createPublicClient: jest.fn(() => ({
    getTransactionReceipt: jest.fn()
  })),
}));