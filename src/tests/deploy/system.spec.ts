
import {describe, expect, beforeEach, test, it} from '@jest/globals';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy, TDeployedContractsManifest, TDeployManifest, TDeployStateMutations, TEnvironmentManifest, TUpgrade, TUpgradeManifest } from '../../metadata/schema';
import { TStrategyOptions } from '../../signing/strategy';
import { mockDeployDocument, mockTransaction, mockEnvManifest, mockStatefulTransaction } from './mock';
import { canonicalPaths } from '../../metadata/paths';

const {executeSystemPhase} = await import('../../deploy/handlers/system');

describe('system steps', () => {
  let deploy: SavebleDocument<TDeploy>;
  let metatxn: Transaction;
  let options: TStrategyOptions | undefined;

  const expectNoOngoingDeploy = async (txn: Transaction) => {
    const deployManifest = canonicalPaths.deploysManifest(deploy._.env)
    const envManifest = await txn.getJSONFile<TDeployManifest>(deployManifest);
    expect(envManifest._.inProgressDeploy).toBeUndefined();
  }

  beforeEach(() => {
    deploy = mockDeployDocument('', '1-eoa.s.sol');
    const mockFiles: Record<string, TDeployManifest> = {};
    mockFiles[canonicalPaths.deploysManifest(deploy._.env)] = {
      inProgressDeploy: deploy._.name
    }; // mock that deploy is in progress.
    metatxn = mockTransaction(mockFiles)
  })

  describe("'' step", () => {
    beforeEach(() => {
      deploy._.phase = ''
    });
    
    it("should fail instantly if there is an ongoing deploy", async () => {
      // '' phase is when a deploy "begins".
      await expect(executeSystemPhase(deploy, metatxn, {})).rejects.toThrowError(`deploy already in progress`)
      expect(metatxn.commit).not.toBeCalled(); // nothing should be committed.
    })

    it("should start the deploy with phase 1 if there are phases.", async () => {
      const txn = mockTransaction({});
      await expect(executeSystemPhase(deploy, txn, {})).resolves.toBeUndefined()
      expect(deploy._.phase).toEqual('eoa_validate'); // here, it begins the first phase.
    })

    it("should complete the deploy instantly if there are no phases", async () => {
      const txn = mockTransaction({});
      deploy._.segments = [];
      deploy._.segmentId = 0;
      await expect(executeSystemPhase(deploy, txn, {})).resolves.toBeUndefined()
      expect(deploy._.phase).toEqual('complete');
    })
  })

  describe("complete step", () => {
    beforeEach(() => {
      deploy._.phase = 'complete'
    })

    it("should fail if there is no environment manifest", async () => {
      await expect(executeSystemPhase(deploy, metatxn, {})).rejects.toThrowError(`The deploy halted: Corrupted env manifest.`)
    })

    it("should update deploy parameters if mutations occurred", async () => {
      const mockFiles: Record<string, unknown> = {};
      const envManifest = mockEnvManifest();
      const mockStateMutations: TDeployStateMutations = {
        mutations: [{
          prev: undefined,
          // new value of the mutated variable.
          next: "world",
          // the recorded type.
          internalType: 1,

          // the name of the environment value modified. corresponds to `ZEUS_ENV_name` while running.
          name: "hello",
        }]
      }
      const upgradeManifest: TUpgrade = {
        name: 'testUpgrade',
        to: '1.0.1',
        from: '1.0.0',
        commit: 'abcdef',
        phases: [],
      }

      const deployParameters: Record<string, unknown> = {}; // initialize deploy parameters as empty, and hope that `hello` => `world` is updated.
      
      mockFiles[canonicalPaths.environmentManifest(deploy._.env)] = envManifest;
      mockFiles[canonicalPaths.deployStateMutations(deploy._)] = mockStateMutations;
      mockFiles[canonicalPaths.upgradeManifest(deploy._.upgrade)] = upgradeManifest;
      mockFiles[canonicalPaths.deployParameters('', deploy._.env)] = deployParameters;

      const txn = mockStatefulTransaction(mockFiles);
      await expect(executeSystemPhase(deploy, txn, {})).rejects.toThrowError(`The deploy stopped: Deploy completed`);

      await expectNoOngoingDeploy(txn);
      const updatedEnvManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deploy._.env));
      expect(updatedEnvManifest._.deployedVersion).toEqual('1.0.1'); // should set `to` to whatever the upgrade specified.
      expect(updatedEnvManifest._.latestDeployedCommit).toEqual('abcdef') // should update commit to whatever the upgrade specified.
   
      const updatedDeployParameters = await txn.getJSONFile<Record<string, unknown>>(canonicalPaths.deployParameters(``, deploy._.env));
      expect(updatedDeployParameters._['hello']).toEqual('world'); // hello world should be set.
    })

    it("should update deployed contract addresses if deploys occurred", async () => {
      const mockFiles: Record<string, unknown> = {};
      const envManifest = mockEnvManifest();
      const mockStateMutations: TDeployStateMutations = {
        mutations: [{
          prev: undefined,
          next: "world",
          internalType: 1,
          name: "hello",
        },
        {
          prev: "bar",
          next: "baz",
          internalType: 1,
          name: "foo",
        }]
      }
      const upgradeManifest: TUpgrade = {
        name: 'testUpgrade',
        to: '1.0.1',
        from: '1.0.0',
        commit: 'abcdef',
        phases: [],
      }
      const mockDeployedContracts: TDeployedContractsManifest = {contracts: [
        {
          contract: `BigContract`,
          deployedBytecodeHash: `0x123`,
          address: `0x1234`,
          singleton: true,
          lastUpdatedIn: {
            phase: 'eoa_start',
            segment: 0,
            name: 'deployName'
          }
        }
      ]}

      const deployParameters: Record<string, unknown> = {"foo": "bar"}; // initialize deploy parameters as empty, and hope that `hello` => `world` is updated.
      mockFiles[canonicalPaths.deployDeployedContracts(deploy._)] = mockDeployedContracts;
      mockFiles[canonicalPaths.environmentManifest(deploy._.env)] = envManifest;
      mockFiles[canonicalPaths.deployStateMutations(deploy._)] = mockStateMutations;
      mockFiles[canonicalPaths.upgradeManifest(deploy._.upgrade)] = upgradeManifest;
      mockFiles[canonicalPaths.deployParameters('', deploy._.env)] = deployParameters;

      const txn = mockStatefulTransaction(mockFiles);
      await expect(executeSystemPhase(deploy, txn, {})).rejects.toThrowError(`The deploy stopped: Deploy completed`);

      await expectNoOngoingDeploy(txn);
      const updatedEnvManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deploy._.env));
      expect(updatedEnvManifest._.deployedVersion).toEqual('1.0.1'); // should set `to` to whatever the upgrade specified.
      expect(updatedEnvManifest._.latestDeployedCommit).toEqual('abcdef') // should update commit to whatever the upgrade specified.
      expect(updatedEnvManifest._.contracts.static[`BigContract`]?.address).toEqual(`0x1234`); // should commit BigContract.

      const updatedDeployParameters = await txn.getJSONFile<Record<string, unknown>>(canonicalPaths.deployParameters(``, deploy._.env));
      expect(updatedDeployParameters._['hello']).toEqual('world'); // hello world should be set.
      expect(updatedDeployParameters._['foo']).toEqual('baz'); // foo should be updated correctly from bar => baz

      expect(updatedEnvManifest._.deployedVersion).toEqual(`1.0.1`);
      expect(updatedEnvManifest._.latestDeployedCommit).toEqual(`abcdef`);      
    })
  })

  describe("failed step", () => {
    beforeEach(() => {
      deploy._.phase = 'failed'
    })
    it("should fail the deploy", async () => {
      await expect(executeSystemPhase(deploy, metatxn, {})).rejects.toThrowError(`The deploy stopped: Deploy failed`)
      await expectNoOngoingDeploy(metatxn);
    })
  })

  describe("cancelled step", () => {
    beforeEach(() => {
      deploy._.phase = 'cancelled'
    })
    it("should cancel the deploy", async () => {
      await expect(executeSystemPhase(deploy, metatxn, {})).rejects.toThrowError(`The deploy stopped: Deploy cancelled.`)
      await expectNoOngoingDeploy(metatxn);
    })
  })
});