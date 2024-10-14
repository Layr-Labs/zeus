import { privateKeyToAccount } from "viem/accounts";
import { GnosisSigningStrategy } from "./gnosis";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { SEPOLIA_CHAIN_ID } from "./utils";
type TGnosisEOAArgs = {
    privateKey: string;
}

export class GnosisEOAStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.eoa";
    
    async forgeArgs(): Promise<string[]> {
        return ["--private-key", this.args.privateKey, ...await super.forgeArgs()];
    }

    assertValidSubCommandArgs(obj: unknown): obj is TGnosisEOAArgs {
        const args = (obj as Record<string, unknown>);
        if (typeof args.privateKey !== 'string' || !args.privateKey) {
            throw new Error(`Expected --privateKey`);
        }

        return true;
    }

    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const account = privateKeyToAccount(this.args.privateKey! as `0x${string}`);
        const types = getEip712TxTypes(version);
        const typedDataParameters = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: this.args.safeAddress as `0x${string}`,
                chainId: SEPOLIA_CHAIN_ID,
            },
            primaryType: 'SafeTx',
            message: {
                ...txn.data,
                value: txn.data.value,
                safeTxGas: txn.data.safeTxGas,
                baseGas: txn.data.baseGas,
                gasPrice: txn.data.gasPrice,
                nonce: txn.data.nonce,
                refundReceiver: txn.data.refundReceiver,
            }
        };
        return await account.signTypedData(typedDataParameters)
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        return privateKeyToAccount(this.args.privateKey! as `0x${string}`).address;
    }
}