import { describe, it, expect } from '@jest/globals';
import { handler } from '../../../commands/deploy/cmd/run';

describe('deploy run handler - invalid fork', () => {
  it('throws on invalid fork value', async () => {
    await expect(handler({} as any, {
      env: 'mainnet',
      resume: false,
      rpcUrl: undefined,
      json: false,
      upgrade: undefined,
      nonInteractive: undefined,
      fork: 'invalid' as any,
    })).rejects.toThrow("Invalid value for 'fork' - expected one of (tenderly, anvil)");
  });
});


