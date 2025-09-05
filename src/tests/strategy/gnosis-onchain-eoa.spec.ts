import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainEOAStrategy } from '../../signing/strategies/gnosis/onchain/onchainEoa';
import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';

describe('GnosisOnchainEOAStrategy', () => {
  let mockDeploy: SavebleDocument<TDeploy>;
  let mockTransaction: Transaction;
  let strategy: GnosisOnchainEOAStrategy;
  
  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    } as SavebleDocument<TDeploy>;
    
    mockTransaction = {} as Transaction;
    strategy = new GnosisOnchainEOAStrategy(mockDeploy, mockTransaction);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and basic properties', () => {
    test('should have correct id', () => {
      expect(strategy.id).toBe('gnosis.onchain.eoa');
    });

    test('should have correct description', () => {
      expect(strategy.description).toBe('Onchain EOA - Safe.execTransaction() (for 1/N multisigs only)');
    });

    test('should initialize privateKey', () => {
      expect(strategy.privateKey).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('should handle basic instantiation', () => {
      const newStrategy = new GnosisOnchainEOAStrategy(mockDeploy, mockTransaction);
      expect(newStrategy).toBeInstanceOf(GnosisOnchainEOAStrategy);
    });
  });
});