
import {describe, expect, jest, beforeEach, it} from '@jest/globals';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import { mockDeployDocument, mockEnvManifest, mockTransaction } from './mock';
import { canonicalPaths } from '../../metadata/paths';

const oldChildProcess = await import(`child_process`);
jest.unstable_mockModule(`child_process`, () => ({
  ...oldChildProcess,
  execSync: jest.fn(oldChildProcess.execSync)
}));

const {execSync} = await import(`child_process`);
const {executeScriptPhase} = await import('../../deploy/handlers/script');

class ExecutionError {
  status: number;
  stdout: string;
  stderr: string;
  constructor(status: number, stdout: string, stderr: string) {
    this.status = status;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

describe('script steps', () => {
  let deploy: SavebleDocument<TDeploy>;
  let metatxn: Transaction;

  const staticErr = new ExecutionError(1, `stdout`, `stderr`);

  beforeEach(() => {
    jest.resetAllMocks();
    deploy = mockDeployDocument(`script_run`, `1-eoa.s.sol`);
    const mockFiles: Record<string, unknown> = {};
    mockFiles[canonicalPaths.environmentManifest(deploy._.env)] = mockEnvManifest();
    metatxn = mockTransaction(mockFiles);
  })

  it("should advance if the script exits with zero code", async  () => {
    (execSync as jest.Mock<typeof import("child_process").execSync>).mockReturnValueOnce(``)
    await expect(executeScriptPhase(deploy, metatxn, {})).resolves.toBeUndefined();
    expect(deploy._.phase).toEqual(`complete`);
    expect(metatxn.commit).toHaveBeenCalled();
  })

  describe('should fail if', () => {
    it("the script exits with non-zero code", async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw staticErr
      })
      await expect(executeScriptPhase(deploy, metatxn, {})).rejects.toThrow(`The deploy halted: Script src/tests/example/1-eoa.s.sol failed.`);
      expect(deploy._.phase).toEqual(`script_run`);
      expect(metatxn.commit).toHaveBeenCalled();
    })
    it("the script doesn't exist", async () => {
      deploy._.segments[deploy._.segmentId].filename = `unknown_file`;
      await expect(executeScriptPhase(deploy, metatxn, {})).rejects.toThrow(`The deploy halted: Script src/tests/example/unknown_file does not exist.`);
      expect(deploy._.phase).toEqual(`script_run`);
      expect(metatxn.commit).not.toHaveBeenCalled();
    })
    it("the env doesn't exist", async () => {
      deploy._.env = `unknownEnv`;
      await expect(executeScriptPhase(deploy, metatxn, {})).rejects.toThrow(`No such environment: unknownEnv`);
      expect(deploy._.phase).toEqual(`script_run`);
      expect(metatxn.commit).not.toHaveBeenCalled();
    })
  })
});