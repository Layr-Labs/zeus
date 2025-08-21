import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainEOAStrategy } from '../../signing/strategies/gnosis/onchain/onchainEoa';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as prompts from '../../commands/prompts';

// Mock external dependencies
const mockCreateWalletClient = jest.fn();
jest.mock('viem', () => ({
  createWalletClient: mockCreateWalletClient,
  http: jest.fn(),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(),
}));

jest.mock('../../commands/prompts', () => ({
  privateKey: jest.fn(() => Promise.resolve()),
  signerKey: jest.fn(() => Promise.resolve()),
}));

describe('GnosisOnchainEOAStrategy', () => {
  let mockDeploy: SavebleDocument<TDeploy>;
  let mockTransaction: Transaction;
  let strategy: GnosisOnchainEOAStrategy;
  let mockWalletClient: any;
  let mockAccount: any;
  
  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    } as SavebleDocument<TDeploy>;
    
    mockTransaction = {} as Transaction;
    
    mockAccount = {
      address: '0xabc123'
    };
    
    mockWalletClient = {
      account: mockAccount,
      transport: jest.fn()
    };
    
    mockCreateWalletClient.mockReturnValue(mockWalletClient);
    (privateKeyToAccount as any).mockReturnValue(mockAccount);
    
    strategy = new GnosisOnchainEOAStrategy(mockDeploy, mockTransaction);
    strategy.rpcUrl = {
      get: (jest.fn() as any).mockResolvedValue('https://mainnet.infura.io/v3/test')
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should have correct id and description', () => {
    expect(strategy.id).toBe('gnosis.onchain.eoa');
    expect(strategy.description).toBe('Onchain EOA - Safe.execTransaction() (for 1/N multisigs only)');
  });

  describe('constructor - privateKey initialization', () => {
    test('should initialize with privateKey prompt when forMultisig is not set', async () => {
      const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      (prompts.privateKey as any).mockResolvedValue(testPrivateKey);
      
      strategy.forMultisig = undefined;
      const privateKey = await strategy.privateKey.get();
      
      expect(privateKey).toBe(testPrivateKey);
      expect(prompts.privateKey).toHaveBeenCalledWith(1, 'Enter the private key of a signer for your SAFE');
    });

    test('should initialize with signerKey prompt when forMultisig is set', async () => {
      const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const multisigAddress = '0x456' as `0x${string}`;
      (prompts.signerKey as any).mockResolvedValue(testPrivateKey);
      
      strategy.forMultisig = multisigAddress;
      const privateKey = await strategy.privateKey.get();
      
      expect(privateKey).toBe(testPrivateKey);
      expect(prompts.signerKey).toHaveBeenCalledWith(
        1, 
        'https://mainnet.infura.io/v3/test', 
        'Enter the private key of a signer for your SAFE(0x456)', 
        multisigAddress
      );
    });
  });

  describe('getSignerAddress', () => {
    test('should return account address from private key', async () => {
      const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      (prompts.privateKey as any).mockResolvedValue(testPrivateKey);
      
      const address = await strategy.getSignerAddress();
      
      expect(address).toBe('0xabc123');
      expect(privateKeyToAccount).toHaveBeenCalledWith(testPrivateKey);
    });
  });

  describe('getWalletClient', () => {
    test('should return wallet client with EOA account', async () => {
      const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockChain = { 
        id: 1, 
        name: 'mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [''] } },
        blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } }
      };
      (prompts.privateKey as any).mockResolvedValue(testPrivateKey);

      const client = await strategy.getWalletClient(mockChain);
      
      expect(client).toBe(mockWalletClient);
      expect(mockCreateWalletClient).toHaveBeenCalledWith({
        account: mockAccount,
        transport: expect.any(Function),
        chain: mockChain
      });
    });
  });
});