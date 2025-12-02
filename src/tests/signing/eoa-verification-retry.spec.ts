import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import { mockDeployDocument, mockTransaction } from '../deploy/mock';

// Import the module we're testing
const EOASigningStrategyMod = await import('../../signing/strategies/eoa/privateKey');
const prompts = await import('../../commands/prompts');

describe('EOA Strategy Etherscan Verification with Retry', () => {
  let deploy: SavebleDocument<TDeploy>;
  let metatxn: Transaction;

  beforeEach(async () => {
    jest.clearAllMocks();
    deploy = mockDeployDocument('eoa_start', '1-eoa.s.sol');
    metatxn = mockTransaction({
      "environment/testEnv/manifest.json": {id: "testEnv"}
    });
  });

  it('should include retry and delay parameters when etherscan verification is enabled', async () => {
    const etherscanKey = 'test-api-key-123';
    (prompts.etherscanApiKey as jest.Mock<typeof prompts.etherscanApiKey>).mockResolvedValue(etherscanKey);
    (prompts.rpcUrl as jest.Mock<typeof prompts.rpcUrl>).mockResolvedValue('https://eth.llamarpc.com');

    const strategy = new EOASigningStrategyMod.default(deploy, metatxn, {
      nonInteractive: false,
      defaultArgs: {
        rpcUrl: 'https://eth.llamarpc.com',
        overrideEoaPk: `0x04ba7e1737815037a348ec201b6433868f8c297d007b5ca605387fbb21f80516`
      }
    });

    const forgeArgs = await strategy.forgeArgs();

    // Verify that the etherscan API key is included
    expect(forgeArgs).toContain('--etherscan-api-key');
    expect(forgeArgs).toContain(etherscanKey);
    
    // Verify that --verify flag is included
    expect(forgeArgs).toContain('--verify');
    
    // Verify that retry parameters are included
    expect(forgeArgs).toContain('--retries');
    expect(forgeArgs).toContain('15');
    
    // Verify that delay parameters are included (60 seconds = 1 minute)
    expect(forgeArgs).toContain('--delay');
    const delayIndex = forgeArgs.indexOf('--delay');
    expect(forgeArgs[delayIndex + 1]).toBe('60');
  });

  it('should not include verification parameters when etherscan key is not provided', async () => {
    (prompts.etherscanApiKey as jest.Mock<typeof prompts.etherscanApiKey>).mockResolvedValue(false);
    (prompts.rpcUrl as jest.Mock<typeof prompts.rpcUrl>).mockResolvedValue('https://eth.llamarpc.com');

    const strategy = new EOASigningStrategyMod.default(deploy, metatxn, {
      nonInteractive: false,
      defaultArgs: {
        rpcUrl: 'https://eth.llamarpc.com',
        overrideEoaPk: `0x04ba7e1737815037a348ec201b6433868f8c297d007b5ca605387fbb21f80516`
      }
    });

    const forgeArgs = await strategy.forgeArgs();

    // Verify that verification parameters are NOT included
    expect(forgeArgs).not.toContain('--etherscan-api-key');
    expect(forgeArgs).not.toContain('--verify');
    expect(forgeArgs).not.toContain('--retries');
    expect(forgeArgs).not.toContain('--delay');
  });

  it('should not include verification when in fork mode', async () => {
    (prompts.rpcUrl as jest.Mock<typeof prompts.rpcUrl>).mockResolvedValue('https://eth.llamarpc.com');

    const strategy = new EOASigningStrategyMod.default(deploy, metatxn, {
      nonInteractive: true,
      defaultArgs: {
        rpcUrl: 'https://eth.llamarpc.com',
        overrideEoaPk: `0x04ba7e1737815037a348ec201b6433868f8c297d007b5ca605387fbb21f80516`,
        fork: 'anvil'
      }
    });

    const forgeArgs = await strategy.forgeArgs();

    // Verify that verification parameters are NOT included in fork mode
    expect(forgeArgs).not.toContain('--etherscan-api-key');
    expect(forgeArgs).not.toContain('--verify');
    expect(forgeArgs).not.toContain('--retries');
    expect(forgeArgs).not.toContain('--delay');
  });
});

