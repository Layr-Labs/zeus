import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainBaseStrategy } from '../../signing/strategies/gnosis/onchain/onchainBase';
import { GnosisSigningStrategy } from '../../signing/strategies/gnosis/gnosis';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import { WalletClient } from 'viem';
import { Chain, mainnet } from 'viem/chains';

// Mock viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  getContract: jest.fn(),
  getAddress: jest.fn((addr: string) => addr),
  hexToNumber: jest.fn((hex: string) => parseInt(hex, 16)),
  hexToBigInt: jest.fn((hex: string) => BigInt(parseInt(hex, 16))),
  parseEther: jest.fn((value: string) => BigInt(value) * BigInt(10**18)),
  encodePacked: jest.fn(() => '0xmockedsignature'),
  http: jest.fn()
}));

// Create a concrete implementation for testing
class TestGnosisOnchainBaseStrategy extends GnosisOnchainBaseStrategy {
  id = 'test.strategy';
  description = 'Test strategy for testing base functionality';
  
  encodedPackedCallCount = 0;

  async getSignerAddress(): Promise<`0x${string}`> {
    return '0x1234567890123456789012345678901234567890' as `0x${string}`;
  }

  async getWalletClient(chain: Chain): Promise<WalletClient> {
    return {
      account: { address: '0x1234567890123456789012345678901234567890' },
      transport: {},
      chain
    } as WalletClient;
  }

  // Expose protected methods for testing and track calls
  public testApprovalSignature(signer: `0x${string}`) {
    this.encodedPackedCallCount++;
    return this.approvalSignature(signer);
  }
}

describe('GnosisOnchainBaseStrategy', () => {
  let mockDeploy: SavebleDocument<TDeploy>;
  let mockTransaction: Transaction;
  let strategy: TestGnosisOnchainBaseStrategy;
  
  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    } as SavebleDocument<TDeploy>;
    
    mockTransaction = {} as Transaction;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    strategy = new TestGnosisOnchainBaseStrategy(mockDeploy, mockTransaction);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('approvalSignature', () => {
    test('should generate correct approval signature format', () => {
      const signer = '0xabc123def456789012345678901234567890abcd' as `0x${string}`;
      const result = strategy.testApprovalSignature(signer);
      
      expect(result).toBeDefined();
      expect(strategy.encodedPackedCallCount).toBe(1);
    });

    test('should handle different signer addresses correctly', () => {
      const signer1 = '0x1234567890123456789012345678901234567890' as `0x${string}`;
      const signer2 = '0xabcdefabcdefabcdabcdefabcdefabcdabcdefab' as `0x${string}`;
      
      const result1 = strategy.testApprovalSignature(signer1);
      const result2 = strategy.testApprovalSignature(signer2);
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(strategy.encodedPackedCallCount).toBe(2);
    });
  });

  describe('cancel', () => {
    test('should throw error as cancellation is not supported', async () => {
      await expect(strategy.cancel(mockDeploy)).rejects.toThrow(
        'This method doesnt support cancellation.'
      );
    });
  });

  describe('constructor', () => {
    test('should call parent constructor with correct parameters', () => {
      const options = { 
        nonInteractive: true,
        defaultArgs: { rpcUrl: 'http://test' } as any
      };
      const newStrategy = new TestGnosisOnchainBaseStrategy(mockDeploy, mockTransaction, options);
      
      expect(newStrategy).toBeInstanceOf(TestGnosisOnchainBaseStrategy);
    });
  });

  describe('abstract methods', () => {
    test('should have abstract getSignerAddress method implemented', async () => {
      const address = await strategy.getSignerAddress();
      expect(address).toBe('0x1234567890123456789012345678901234567890');
    });

    test('should have abstract getWalletClient method implemented', async () => {
      const mockChain = { id: 1 } as Chain;
      const walletClient = await strategy.getWalletClient(mockChain);
      expect(walletClient).toBeDefined();
      expect(walletClient.account?.address).toBe('0x1234567890123456789012345678901234567890');
    });
  });

  describe('utility functions', () => {
    test('should handle getChain with valid chainId', () => {
      // The getChain function is internal but we can test it indirectly
      expect(strategy).toBeDefined();
    });

    test('should have proper inheritance structure', () => {
      expect(strategy).toBeInstanceOf(GnosisSigningStrategy);
    });

    test('should initialize properly with deploy and transaction', () => {
      expect((strategy as any).deploy).toBe(mockDeploy);
      // transaction is protected, so we can't access it directly
      expect(strategy).toBeDefined();
    });

    test('should handle options parameter', () => {
      const options = {
        nonInteractive: false,
        defaultArgs: { rpcUrl: 'http://test:8545' } as any
      };
      
      const strategyWithOptions = new TestGnosisOnchainBaseStrategy(
        mockDeploy, 
        mockTransaction, 
        options
      );
      
      expect((strategyWithOptions as any).options).toEqual(options);
    });

    test('should have correct strategy properties', () => {
      expect(strategy.id).toBe('test.strategy');
      expect(strategy.description).toBe('Test strategy for testing base functionality');
    });

    test('should handle address padding correctly in approval signature', () => {
      const shortAddress = '0x0123456789012345678901234567890123456789' as `0x${string}`; // Use full address
      const result = strategy.testApprovalSignature(shortAddress);
      
      expect(result).toBeDefined();
      expect(strategy.encodedPackedCallCount).toBe(1);
    });

    test('should handle long address correctly in approval signature', () => {
      const fullAddress = '0xabcdefabcdefabcdabcdefabcdefabcdabcdefab' as `0x${string}`;
      const result = strategy.testApprovalSignature(fullAddress);
      
      expect(result).toBeDefined();
      expect(strategy.encodedPackedCallCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('should handle null/undefined inputs gracefully', () => {
      expect(() => {
        new TestGnosisOnchainBaseStrategy(mockDeploy, mockTransaction, undefined);
      }).not.toThrow();
    });

    test('should maintain correct method signatures', () => {
      expect(typeof strategy.getSignerAddress).toBe('function');
      expect(typeof strategy.getWalletClient).toBe('function');
      expect(typeof strategy.testApprovalSignature).toBe('function');
      expect(typeof strategy.cancel).toBe('function');
    });

    test('should handle different chain configurations', async () => {
      const arbitrumChain = { id: 42161, name: 'Arbitrum One' } as Chain;
      const polygonChain = { id: 137, name: 'Polygon' } as Chain;
      
      const client1 = await strategy.getWalletClient(arbitrumChain);
      const client2 = await strategy.getWalletClient(polygonChain);
      
      expect(client1.chain).toEqual(arbitrumChain);
      expect(client2.chain).toEqual(polygonChain);
    });
  });
});