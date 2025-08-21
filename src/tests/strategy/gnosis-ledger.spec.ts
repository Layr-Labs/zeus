import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainLedgerStrategy } from '../../signing/strategies/gnosis/onchain/onchainLedger';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import { createPublicClient, createWalletClient, getContract } from 'viem';
import { getLedgerAccount } from '../../signing/strategies/ledgerTransport';
import * as prompts from '../../commands/prompts';

// Mock external dependencies
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  getContract: jest.fn(),
  http: jest.fn(),
}));

jest.mock('../../signing/strategies/ledgerTransport', () => ({
  getLedgerAccount: jest.fn(),
}));

jest.mock('../../commands/prompts', () => ({
  bip32Path: jest.fn(() => Promise.resolve()),
  pressAnyButtonToContinue: jest.fn(() => Promise.resolve()),
}));

jest.mock('viem/chains', () => ({
  mainnet: { 
    id: 1, 
    name: 'mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [''] } },
    blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } }
  },
  goerli: { 
    id: 5, 
    name: 'goerli',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [''] } },
    blockExplorers: { default: { name: 'Etherscan', url: 'https://goerli.etherscan.io' } }
  },
}));

describe('GnosisOnchainLedgerStrategy', () => {
  let mockDeploy: SavebleDocument<TDeploy>;
  let mockTransaction: Transaction;
  let strategy: GnosisOnchainLedgerStrategy;
  let mockSafeContract: any;
  let mockPublicClient: any;
  let mockWalletClient: any;
  
  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    } as SavebleDocument<TDeploy>;
    
    mockTransaction = {} as Transaction;
    
    // Setup mocks
    mockSafeContract = {
      read: {
        isOwner: jest.fn()
      }
    };
    
    mockPublicClient = {
      transport: jest.fn()
    };
    
    mockWalletClient = {
      account: { address: '0x123' },
      transport: jest.fn()
    };
    
    (getContract as any).mockReturnValue(mockSafeContract);
    (createPublicClient as any).mockReturnValue(mockPublicClient);
    (createWalletClient as any).mockReturnValue(mockWalletClient);
    
    strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    strategy.forMultisig = '0x456' as `0x${string}`;
    strategy.rpcUrl = {
      get: (jest.fn() as any).mockResolvedValue('https://mainnet.infura.io/v3/test')
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should have correct id and description', () => {
    expect(strategy.id).toBe('gnosis.onchain.ledger');
    expect(strategy.description).toBe('Onchain Ledger - Safe.execTransaction() (for 1/N multisigs only)');
  });

  test('should initialize bip32Path correctly', async () => {
    (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
    
    const path = await strategy.bip32Path.get();
    expect(path).toBe("m/44'/60'/0'/0/0");
    expect(prompts.bip32Path).toHaveBeenCalled();
  });

  describe('getSignerAddress', () => {
    test('should return signer address when ledger is unlocked and is owner', async () => {
      const mockAccount = { address: '0xabc123' };
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any).mockResolvedValue(mockAccount);
      (mockSafeContract.read.isOwner as any).mockResolvedValue(true);

      const address = await strategy.getSignerAddress();
      
      expect(address).toBe('0xabc123');
      expect(getLedgerAccount).toHaveBeenCalledWith("m/44'/60'/0'/0/0");
      expect(mockSafeContract.read.isOwner).toHaveBeenCalledWith(['0xabc123']);
    });

    test('should throw error when ledger address is not a signer on multisig', async () => {
      const mockAccount = { address: '0xabc123' };
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any).mockResolvedValue(mockAccount);
      (mockSafeContract.read.isOwner as any).mockResolvedValue(false);

      await expect(strategy.getSignerAddress()).rejects.toThrow(
        'This ledger path (accountIndex=m/44\'/60\'/0\'/0/0) produced address (0xabc123), which is not a signer on the multisig (0x456)'
      );
    });

    test('should skip owner check when forMultisig is not set', async () => {
      const mockAccount = { address: '0xabc123' };
      strategy.forMultisig = undefined;
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any).mockResolvedValue(mockAccount);

      const address = await strategy.getSignerAddress();
      
      expect(address).toBe('0xabc123');
      expect(mockSafeContract.read.isOwner).not.toHaveBeenCalled();
    });

    test('should handle locked device error and retry', async () => {
      const mockAccount = { address: '0xabc123' };
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any)
        .mockRejectedValueOnce(new Error('Locked device'))
        .mockResolvedValue(mockAccount);
      (mockSafeContract.read.isOwner as any).mockResolvedValue(true);
      (prompts.pressAnyButtonToContinue as any).mockResolvedValue(undefined);

      const address = await strategy.getSignerAddress();
      
      expect(address).toBe('0xabc123');
      expect(prompts.pressAnyButtonToContinue).toHaveBeenCalled();
      expect(getLedgerAccount).toHaveBeenCalledTimes(2);
    });

    test('should throw unknown ledger errors', async () => {
      const unknownError = new Error('Unknown ledger error');
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any).mockRejectedValue(unknownError);

      await expect(strategy.getSignerAddress()).rejects.toThrow(
        'An error occurred while accessing the Ledger'
      );
    });
  });

  describe('getWalletClient', () => {
    test('should return wallet client with ledger account', async () => {
      const mockAccount = { address: '0xabc123' };
      const mockChain = { 
        id: 1, 
        name: 'mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [''] } },
        blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } }
      };
      (prompts.bip32Path as any).mockResolvedValue("m/44'/60'/0'/0/0");
      (getLedgerAccount as any).mockResolvedValue(mockAccount);

      const client = await strategy.getWalletClient(mockChain);
      
      expect(client).toBe(mockWalletClient);
      expect(createWalletClient).toHaveBeenCalledWith({
        account: mockAccount,
        transport: expect.any(Function),
        chain: mockChain
      });
    });
  });
});