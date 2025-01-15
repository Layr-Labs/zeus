import { describe, test, beforeEach, jest, expect, afterEach } from '@jest/globals';
import { run, Runner } from "cmd-ts";

class MockExit {
  static didExit = false;
  constructor(config: {
      exitCode: number;
      message: string;
      into: 'stdout' | 'stderr';
  }) {};

  // @ts-expect-error
  run(): never {
    MockExit.didExit = true;
  }

  dryRun(): string {
    return `error`;
  }
}

jest.unstable_mockModule('cmd-ts/dist/cjs/effects', () => {
  return {
    Exit: MockExit
  }
})
const { Exit } = await import('cmd-ts/dist/cjs/effects');


const { getZeus } = await import('../index');

type CmdResult = {
  all: string;
  exitCode: number;
}

describe('cli integration', () => {
  let zeus: Runner<any, any>;
  let stdout: string[] = [];
  let stderr: string[] = [];
  
  beforeEach(async () => {
    zeus = await getZeus();
    stdout = [];
    stderr = [];
    jest.spyOn(console, `log`).mockImplementation((line, ...args) => stdout.push([line, ...args].join(' ')))
    jest.spyOn(console, `warn`).mockImplementation((line, ...args) => stderr.push([line, ...args].join(' ')))
    jest.spyOn(console, `error`).mockImplementation((line, ...args) => stderr.push([line, ...args].join(' ')))
  })

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  // helper to 
  const testCommand = (cmd: string, description: string, then: (task: Promise<CmdResult>) => Promise<void>) => {
    test(`${cmd} - ${description}`, async () => {
      try {
        debugger;
        const p = run(zeus, cmd.split('').slice(1))
        await then(p);
        await p;
      } catch (e) {
        throw new Error(`An uncaught error happened during command: ${cmd}`, {cause: e});
      }
    })
  }

  testCommand('zeus which 0x0000000000000000000000000000000000000000', `can locate addresses`, async (result: Promise<CmdResult>) => {
    expect(stderr).toBe([]);
    expect(stdout).toBe([]);
    expect(MockExit.didExit).toBe(true);
  });

  // testCommand('zeus which 0x0000000000000000000000000000000000000000', `can locate parameters`, async (result: Promise<CmdResult>) => {
  //   expect(stderr).toBe([]);
  //   expect(stdout).toBe([]);
  //   expect((await result).exitCode).toBe(1);
  // });
});