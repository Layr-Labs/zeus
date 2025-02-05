import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TStrategyOptions } from '../../signing/strategy';
import { TDeploy } from '../../metadata/schema';
import type { PublicClient, TransactionReceipt } from 'viem';
import {mockDeployDocument, mockTransaction, mockNextSelectedStrategy} from './mock';
import { mockForgeScriptOutput, MockStrategy } from './mockStrategy';

const {runTest} = await import('../../signing/strategies/test');
const prompts = await import('../../commands/prompts')
const {executeEOAPhase} = await import('../../deploy/handlers/eoa');
const { createPublicClient, TransactionReceiptNotFoundError } = await import('viem');
const EOASigningStrategyMod = await import('../../signing/strategies/eoa/privateKey');

import type EOASigningStrategy  from '../../signing/strategies/eoa/privateKey'

describe('executeEOAPhase', () => {
  let deploy: SavebleDocument<TDeploy>;
  let metatxn: Transaction;
  let options: TStrategyOptions | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.spyOn(console, 'log');
    jest.spyOn(console, 'warn');
    jest.spyOn(console, 'error');

    deploy = mockDeployDocument('eoa_validate', '1-eoa.s.sol');
    metatxn = mockTransaction();
    options = {
      nonInteractive: false,
      defaultArgs: {rpcUrl: 'https://google.com'}
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should exit early if phase is unknown', async () => {
    // @ts-expect-error testing an invalid data model
    deploy._.phase = 'something_unexpected';

    await expect(executeEOAPhase(deploy, metatxn, options)).rejects.toThrowError('Unknown deploy phase.');

    // No calls to deploy.save or metatxn.commit
    expect(deploy.save).not.toHaveBeenCalled();
    expect(metatxn.commit).not.toHaveBeenCalled();
  });

  describe('phase: "eoa_validate"', () => {
    it('should exit early if script does not exist', async () => {
      (runTest as jest.Mock<typeof runTest>).mockResolvedValue({ forge: undefined, code: 0, stdout: '', stderr: '' }); // test pass
      
      await expect(executeEOAPhase(deploy, metatxn, options)).rejects.toThrowError();

      expect(deploy.save).not.toHaveBeenCalled();
      expect(metatxn.commit).not.toHaveBeenCalled();
    });

    it('should run tests and advance if all goes well (non-interactive = false)', async () => {
      (runTest as jest.Mock<typeof runTest>).mockResolvedValue({ forge: undefined, code: 0, stdout: '', stderr: '' }); // test pass
      
      const txn = mockTransaction({
        "environment/testEnv/manifest.json": {id: "testEnv"}
      });
      const mockStrategy = new MockStrategy(deploy, txn, options);
      mockNextSelectedStrategy(mockStrategy);
      (prompts.wouldYouLikeToContinue as jest.Mock<typeof prompts.wouldYouLikeToContinue>).mockResolvedValue(true);

      await executeEOAPhase(deploy, txn, options);

      // It should have invoked runTest
      expect(runTest).toHaveBeenCalled();
      // Should have advanced the phase
      expect(deploy.save).toHaveBeenCalled();
      expect(txn.commit).toHaveBeenCalledWith(
        '[deploy testDeploy] eoa test'
      );
      // Confirm we see a success log
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('recorded successful test run')
      );
    });

    it('should throw an error if tests fail', async () => {
      (runTest as jest.Mock<typeof runTest>).mockResolvedValue({ code: 1, stdout: '', stderr: '', forge: undefined }); // test failure
      
      await expect(executeEOAPhase(deploy, metatxn, options)).rejects.toThrowError(`The deploy halted: One or more tests failed.`);
      
      // Should have tried to run tests
      expect(runTest).toHaveBeenCalled();

      // Doesn't save
      expect(deploy.save).not.toHaveBeenCalled();
      expect(metatxn.commit).not.toHaveBeenCalled();
    });
  });

  describe('phase: "eoa_start"', () => {
    beforeEach(() => {
      deploy._.phase = 'eoa_start';
    });

    it('should exit early if script does not exist', async () => {
      const missingDeploy = mockDeployDocument('eoa_start', 'missing/script.s.sol') as SavebleDocument<TDeploy>;
      await expect(executeEOAPhase(missingDeploy, metatxn, options)).rejects.toThrowError('Deploy failed - missing expected script. Please try again.')

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing expected script')
      );
      expect(deploy.save).not.toHaveBeenCalled();
      expect(metatxn.commit).not.toHaveBeenCalled();
    });

    it('should complete successfully', async () => {
      const metatxn = mockTransaction({
        "environment/testEnv/manifest.json": {id: "testEnv"}
      });

      (runTest as jest.Mock<typeof runTest>).mockResolvedValue({ code: 0, stdout: '', stderr: '', forge: undefined }); // test success
      (prompts.etherscanApiKey as jest.Mock<typeof prompts.etherscanApiKey>).mockResolvedValue('123');
      const options = {
        nonInteractive: false,
        defaultArgs: {rpcUrl: 'https://google.com', overrideEoaPk: `0x04ba7e1737815037a348ec201b6433868f8c297d007b5ca605387fbb21f80516`}
      } as const;

      const deploy = mockDeployDocument('eoa_start', '1-eoa.s.sol') as SavebleDocument<TDeploy>;
      const strat = new EOASigningStrategyMod.default(deploy, metatxn, options);

      jest.spyOn(strat, 'runForgeScript');
      (strat.runForgeScript as jest.Mock<typeof strat['runForgeScript']>).mockImplementation(async function (this: EOASigningStrategy) {
        await this.forgeArgs(); // mock runForgeScript as accessing the args.
        // TODO: this mocking could mock something within runForgeScript instead to be more accurate.
        return mockForgeScriptOutput;
      });

      mockNextSelectedStrategy(strat);
      
      await expect(executeEOAPhase(deploy, metatxn, options)).resolves.toBeUndefined()

      expect(deploy.save).toHaveBeenCalled();
      expect(metatxn.commit).toHaveBeenCalled();

      // should prompt for etherscan api key.
      expect(strat.runForgeScript).toHaveBeenCalled();
      expect(prompts.etherscanApiKey).toHaveBeenCalled();
    });
  })

  describe('phase: "eoa_wait_confirm"', () => {
    beforeEach(() => {
      deploy._.phase = 'eoa_wait_confirm';
    });

    it('should confirm transactions if they succeed and advance', async () => {
      const mockClient = {
        getTransactionReceipt: jest.fn<() => Promise<{status: 'success'}>>().mockResolvedValue({status: 'success'})
      } as unknown as PublicClient;
      (createPublicClient as jest.Mock<() => PublicClient>).mockReturnValue(mockClient);

      // The foundryDeploy JSON file
      (metatxn.getJSONFile as jest.Mock<typeof metatxn.getJSONFile>).mockImplementation(async <T>(path: string) => {
        // If the path ends with 'foundry.deploy.json'
        if (path.includes('foundry.deploy.json')) {
          return {
            _: {
              transactions: [{ hash: '0xABC123' }]
            },
            save: jest.fn()
          } as unknown as SavebleDocument<T>;
        }
        // fallback for other JSON files
        return {
          _: {},
          save: jest.fn()
        } as unknown as SavebleDocument<T>;
      });

      // @ts-expect-error not typing this out
      mockClient.getTransactionReceipt.mockResolvedValue({ status: 'success' });

      await executeEOAPhase(deploy, metatxn, options);

      // Should confirm the transaction
      expect(mockClient.getTransactionReceipt).toHaveBeenCalledWith({
        hash: '0xABC123'
      });
      // Should mark the segment as confirmed
      expect(deploy._.metadata[deploy._.segmentId].confirmed).toBe(true);
      // Should have advanced
      expect(deploy.save).toHaveBeenCalled();
      expect(metatxn.commit).toHaveBeenCalledWith(
        '[deploy testDeploy] eoa transaction confirmed'
      );
    });

    it('should handle a TransactionReceiptNotFoundError and keep polling', async () => {
      const mockClient = {
        getTransactionReceipt: jest.fn<PublicClient['getTransactionReceipt']>()
      };
      (createPublicClient as jest.Mock).mockReturnValue(mockClient);

      (metatxn.getJSONFile as jest.Mock<typeof metatxn.getJSONFile>).mockImplementation(async <T>() => {
        return {
          _: {
            transactions: [{ hash: '0xABC123' }]
          },
          save: jest.fn()
        } as unknown as SavebleDocument<T>;
      });

      // First call: throw TransactionReceiptNotFoundError
      // Second call: success
      mockClient.getTransactionReceipt
        .mockRejectedValueOnce(new TransactionReceiptNotFoundError({hash: '0xABC1234'}))
        .mockResolvedValueOnce({ status: 'success' } as unknown as TransactionReceipt);

      await executeEOAPhase(deploy, metatxn, options);

      // We expect it to have retried at least once
      expect(mockClient.getTransactionReceipt).toHaveBeenCalledTimes(2);

      expect(deploy._.metadata[deploy._.segmentId].confirmed).toBe(true);
      expect(deploy.save).toHaveBeenCalled();
      expect(metatxn.commit).toHaveBeenCalledWith(
        '[deploy testDeploy] eoa transaction confirmed'
      );
    });
  });
});