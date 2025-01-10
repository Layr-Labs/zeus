import { ledgerToAccount } from '@celo/viem-account-ledger';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SafeMultisigTransactionResponse, SafeMultisigConfirmationResponse } from '@safe-global/types-kit';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

type TGetTransaction = import('@safe-global/api-kit').default['getTransaction']

// @ts-expect-error
export const mockGetTransaction = jest.fn<TGetTransaction>().mockResolvedValue({ confirmations: [{}], confirmationsRequired: 2 })

const mockConfirmation: () => SafeMultisigConfirmationResponse = () => {
    return {
        owner: "0x1234567890abcdef1234567890abcdef12345678",
        submissionDate: "2025-01-01T12:00:00.000Z",
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        confirmationType: "StaticConfirmation",
        signature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        signatureType: "ETH_SIGN",
    };
}

export const mockSafeInfo = (confirmations: {required: number, present: number}, extraInfo?: Partial<SafeMultisigTransactionResponse>) => {
    mockGetTransaction.mockReset();
    mockGetTransaction.mockResolvedValue({
        safe: "0x1234567890abcdef1234567890abcdef12345678",
        to: "0xabcdef1234567890abcdef1234567890abcdef12",
        value: "100.00",
        data: "0xabcdef123456",
        operation: 0,
        gasToken: "0xabcdef1234567890abcdef1234567890abcdef12",
        safeTxGas: 50000,
        baseGas: 25000,
        gasPrice: "0.00000001",
        refundReceiver: "0xabcdef1234567890abcdef1234567890abcdef12",
        nonce: 1,
        executionDate: "2025-01-01T12:00:00.000Z",
        submissionDate: "2025-01-01T12:00:00.000Z",
        modified: "2025-01-01T12:00:00.000Z",
        blockNumber: 123456,
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        safeTxHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        executor: "0xabcdef1234567890abcdef1234567890abcdef12",
        proposer: "0x1234567890abcdef1234567890abcdef12345678",
        isExecuted: true,
        isSuccessful: true,
        ethGasPrice: "0.00000001",
        gasUsed: 40000,
        fee: "0.0004",
        origin: "StaticOrigin",
        dataDecoded: "Static Decoded Data",
        confirmationsRequired: confirmations.required,
        confirmations: [
            ...Array.from({ length: confirmations.present }, () => mockConfirmation())
        ],
        trusted: true,
        signatures: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        ...(extraInfo ?? {})
    })
}

export default class MockApi {
  getTransaction = mockGetTransaction
};