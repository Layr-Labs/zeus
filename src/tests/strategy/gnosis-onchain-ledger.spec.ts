import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { GnosisOnchainBaseStrategy } from '../../signing/strategies/gnosis/onchain/onchainBase';

// Mock dependencies to avoid external calls
jest.mock('../../signing/strategies/ledgerTransport', () => ({
  getLedgerAccount: jest.fn()
}));

jest.mock('../../commands/prompts', () => ({
  bip32Path: jest.fn(),
  pressAnyButtonToContinue: jest.fn()
}));

import { GnosisOnchainLedgerStrategy } from '../../signing/strategies/gnosis/onchain/onchainLedger';

// Simple basic tests to ensure core functionality coverage without calling methods that require user interaction
describe('GnosisOnchainLedgerStrategy - Coverage Tests', () => {
  let mockDeploy: any;
  let mockTransaction: any;

  beforeEach(() => {
    mockDeploy = {
      _: {
        chainId: 1,
        name: 'test-deploy',
        env: 'test'
      }
    };
    mockTransaction = {};
  });

  test('should have correct id and description', () => {
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(strategy.id).toBe('gnosis.onchain.ledger');
    expect(strategy.description).toBe('Onchain Ledger - Safe.execTransaction() (for 1/N multisigs only)');
    expect(strategy.bip32Path).toBeDefined();
  });

  test('should be instance of GnosisOnchainBaseStrategy', () => {
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(strategy).toBeInstanceOf(GnosisOnchainBaseStrategy);
  });

  test('should have required methods', () => {
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(typeof strategy.getSignerAddress).toBe('function');
    expect(typeof strategy.getWalletClient).toBe('function');
  });

  test('should initialize with options', () => {
    const options = { 
      nonInteractive: true,
      defaultArgs: { rpcUrl: 'http://localhost:8545' } as any
    };
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction, options);
    expect(strategy).toBeInstanceOf(GnosisOnchainLedgerStrategy);
  });
});