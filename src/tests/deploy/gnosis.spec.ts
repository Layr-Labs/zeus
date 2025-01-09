import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TStrategyOptions } from '../../signing/strategy';
import { TDeploy } from '../../metadata/schema';
import {mockDeployDocument, mockTransaction} from './mock';
import MockApiKit, { mockGetTransaction, mockSafeInfo } from '../../../__mocks__/@safe-global/api-kit';
import { canonicalPaths } from '../../metadata/paths';
import { PublicClient } from 'viem';

const {runTest} = await import('../../signing/strategies/test');
const prompts = await import('../../commands/prompts')
const {executeMultisigPhase} = await import('../../deploy/handlers/gnosis');
const { createPublicClient, TransactionReceiptNotFoundError } = await import('viem');

jest.mock("@safe-global/api-kit", () => MockApiKit);

describe('executeMultisigPhase', () => {
  let deploy: SavebleDocument<TDeploy>;
  let metatxn: Transaction;
  let options: TStrategyOptions | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    deploy = mockDeployDocument('multisig_start', '1-multisig.s.sol');
    metatxn = mockTransaction();
    options = {
      nonInteractive: false,
      defaultArgs: {rpcUrl: 'https://google.com'}
    };
  });

  describe("multisig_start", () => {
    beforeEach(() => {
      deploy._.phase = "multisig_start";
    });

    it("should fail if script doesn't exist", async () => {

    })

    describe("immediate execution mode", () => {
      beforeEach(() => {
        // TODO: mock the strategy to return immediateExecution.
      })

      it("should halt if unsuccessful", async () => {

      })
      it("should advice to next segment if successful", async () => {

      })
    })

    it("should save multisig run if successful and advance", () => {

    })
  })
  
  describe("multisig_wait_signers", () => {
    beforeEach(() => {
      deploy._.phase = "multisig_wait_signers";
    });

    it("should throw an error if confirmations are insufficient", async () => {
      mockSafeInfo({required: 2, present: 1});

      const gnosisRunPath = canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
      const mockedFiles: Record<string, unknown> = {};
      mockedFiles[gnosisRunPath] = {
        safeTxHash: `0xsafehash`,
        safeAddress: `0xsafeaddress`
      }

      metatxn = mockTransaction(mockedFiles);
      await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrow(
        "Waiting on multisig signers."
      );
  
      expect(mockGetTransaction).toHaveBeenCalledWith("0xsafehash");
      // expect(advance).not.toHaveBeenCalled();
      expect(deploy.save).not.toHaveBeenCalled();
    });

    it("should proceed if confirmations are sufficient", async () => {
      mockSafeInfo({required: 2, present: 2});

      const gnosisRunPath = canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})
      const mockedFiles: Record<string, unknown> = {};
      mockedFiles[gnosisRunPath] = {
        safeTxHash: `0xsafehash`,
        safeAddress: `0xsafeaddress`
      }

      metatxn = mockTransaction(mockedFiles);
      await expect(executeMultisigPhase(deploy, metatxn, undefined)).resolves.toBeUndefined();
  
      expect(mockGetTransaction).toHaveBeenCalledWith("0xsafehash");
      // expect(advance).not.toHaveBeenCalled();
      expect(deploy.save).toHaveBeenCalled();
    });
  })

  describe("multisig_wait_confirm", () => {
    beforeEach(() => {
      deploy._.phase = "multisig_wait_confirm";
      mockSafeInfo({required: 1, present: 1})
    });

    describe("should fail if", () => {
      it("data is corrupted", async () => {
        metatxn = mockTransaction({}); // no file
        await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrowError(`Zeus script outputted no multisig transactions`);
      })

      it("transaction receipt indicates failure", async () => {
        const files: Record<string, unknown> = {};
        files[canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})] = {
          transactionHash: `0xtransactionHash`,
          safeTxHash: `0xsafehash`,
          executionDate: '123'
        };

        const mockClient = {
          waitForTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure'}>>().mockResolvedValueOnce({status: 'failure'}),
          getTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure'}>>().mockResolvedValueOnce({status: 'failure'})
        } as unknown as PublicClient;
        (createPublicClient as jest.Mock<() => PublicClient>).mockReturnValueOnce(mockClient);

        metatxn = mockTransaction(files); // no file
        await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrowError(`The deploy halted: Multisig transaction failed.`);
      })

      it("transaction receipt isn't available yet", async () => {
        const files: Record<string, unknown> = {};
        files[canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})] = {
          transactionHash: `0xtransactionHash`,
          safeTxHash: `0xsafehash`,
          executionDate: '123'
        };

        const mockClient = {
          waitForTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure'}>>().mockRejectedValueOnce(new Error('fake transaction hasnt landed yet')),
          getTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure'}>>().mockRejectedValueOnce(new Error('fake transaction hasnt landed yet'))
        } as unknown as PublicClient;
        (createPublicClient as jest.Mock<() => PublicClient>).mockReturnValueOnce(mockClient);

        metatxn = mockTransaction(files); // no file
        await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrowError(`The deploy halted: Transaction (0xtransactionHash) might have not landed in a block yet.`);
      })
    })

    it("should advance if transaction receipt indicates success", async () => {
      const files: Record<string, unknown> = {};
        files[canonicalPaths.multisigTransaction({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId})] = {
          transactionHash: `0xtransactionHash`,
          safeTxHash: `0xsafehash`,
          executionDate: '123'
        };

        const mockClient = {
          waitForTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure', transactionHash: `0x${string}`}>>().mockResolvedValueOnce({status: 'success', transactionHash: `0x123`}),
          getTransactionReceipt: jest.fn<() => Promise<{status: 'success' | 'failure', transactionHash: `0x${string}`}>>().mockResolvedValueOnce({status: 'success', transactionHash: `0x123`})
        } as unknown as PublicClient;
        (createPublicClient as jest.Mock<() => PublicClient>).mockReturnValueOnce(mockClient);

        metatxn = mockTransaction(files); // no file
        await expect(executeMultisigPhase(deploy, metatxn, undefined)).resolves.toBeUndefined();
        expect(deploy._.phase).toEqual(`complete`)
    });

  })
  
  describe("multisig_execute", () => {
    beforeEach(() => {
      deploy._.phase = "multisig_execute";
    });

    it("should advance if transaction is already executed", async () => {
      mockSafeInfo({required: 1, present : 1}, {isExecuted: true, isSuccessful: true});
      await expect(executeMultisigPhase(deploy, metatxn, undefined)).resolves.toBeUndefined();
      expect(deploy._.phase).toEqual(`multisig_wait_confirm`)
    })

    it("should halt if transaction executed unsuccessfully", async () => {
      mockSafeInfo({required: 1, present : 1}, {isExecuted: true, isSuccessful: false});
      await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrowError('The deploy halted: Multisig transaction failed.');
    })

    it("should halt if transaction was not executed yet", async () => {
      mockSafeInfo({required: 1, present : 1}, {isExecuted: false, isSuccessful: undefined});
      await expect(executeMultisigPhase(deploy, metatxn, undefined)).rejects.toThrowError('The deploy halted: Waiting on multisig transaction execution.');
    })
  })

  afterEach(() => {
    jest.resetAllMocks();
  });
});