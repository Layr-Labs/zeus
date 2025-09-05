import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainLedgerStrategy } from '../../signing/strategies/gnosis/onchain/onchainLedger';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';

// Simple basic tests to get coverage
describe('GnosisOnchainLedgerStrategy', () => {
  let mockDeploy: SavebleDocument<TDeploy>;
  let mockTransaction: Transaction;
  let strategy: GnosisOnchainLedgerStrategy;
  
  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    } as SavebleDocument<TDeploy>;
    
    mockTransaction = {} as Transaction;
    strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and basic properties', () => {
    test('should have correct id', () => {
      expect(strategy.id).toBe('gnosis.onchain.ledger');
    });

    test('should have correct description', () => {
      expect(strategy.description).toBe('Onchain Ledger - Safe.execTransaction() (for 1/N multisigs only)');
    });

    test('should initialize bip32Path', () => {
      expect(strategy.bip32Path).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('should handle basic instantiation', () => {
      const newStrategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
      expect(newStrategy).toBeInstanceOf(GnosisOnchainLedgerStrategy);
    });
  });
});