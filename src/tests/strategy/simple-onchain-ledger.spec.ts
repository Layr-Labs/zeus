import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { GnosisOnchainLedgerStrategy } from '../../signing/strategies/gnosis/onchain/onchainLedger';
import { GnosisOnchainBaseStrategy } from '../../signing/strategies/gnosis/onchain/onchainBase';

// Mock dependencies to avoid external calls
jest.mock('../../signing/strategies/ledgerTransport', () => ({
  getLedgerAccount: jest.fn()
}));

jest.mock('../../commands/prompts', () => ({
  bip32Path: jest.fn(),
  pressAnyButtonToContinue: jest.fn()
}));

// Simple basic tests to ensure core functionality coverage
describe('GnosisOnchainLedgerStrategy - Coverage Tests', () => {
  test('should have correct id and description', () => {
    const mockDeploy = {
      _: { chainId: 1, name: 'test', env: 'test' }
    } as any;
    const mockTransaction = {} as any;
    
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(strategy.id).toBe('gnosis.onchain.ledger');
    expect(strategy.description).toBe('Onchain Ledger - Safe.execTransaction() (for 1/N multisigs only)');
    expect(strategy.bip32Path).toBeDefined();
  });

  test('should be instance of GnosisOnchainBaseStrategy', () => {
    const mockDeploy = {
      _: { chainId: 1, name: 'test', env: 'test' }
    } as any;
    const mockTransaction = {} as any;
    
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(strategy).toBeInstanceOf(GnosisOnchainBaseStrategy);
  });

  test('should have required methods', () => {
    const mockDeploy = {
      _: { chainId: 1, name: 'test', env: 'test' }
    } as any;
    const mockTransaction = {} as any;
    
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    expect(typeof strategy.getSignerAddress).toBe('function');
    expect(typeof strategy.getWalletClient).toBe('function');
  });

  test('should handle options in constructor', () => {
    const mockDeploy = {
      _: { chainId: 1, name: 'test', env: 'test' }
    } as any;
    const mockTransaction = {} as any;
    const mockOptions = {
      nonInteractive: true,
      defaultArgs: { rpcUrl: 'http://localhost:8545' }
    } as any;
    
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction, mockOptions);
    
    expect(strategy).toBeInstanceOf(GnosisOnchainLedgerStrategy);
  });

  test('should be able to set forMultisig property', () => {
    const mockDeploy = {
      _: { chainId: 1, name: 'test', env: 'test' }
    } as any;
    const mockTransaction = {} as any;
    
    const strategy = new GnosisOnchainLedgerStrategy(mockDeploy, mockTransaction);
    
    strategy.forMultisig = '0xsafeaddress' as `0x${string}`;
    expect(strategy.forMultisig).toBe('0xsafeaddress');
  });
});