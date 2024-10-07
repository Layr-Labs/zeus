import { privateKeyToAccount } from "viem/accounts";
import { GnosisSigningStrategy } from "./gnosis.js";
import {SafeTransaction} from "@safe-global/safe-core-sdk-types";
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index.js"

type TGnosisEOAArgs = {
    privateKey: string;
}

export class GnosisEOAStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.eoa";
    
    forgeArgs(): string[] {
        return ["--private-key", this.args.privateKey];
    }

    isValidSubCommandArgs(obj: any): obj is TGnosisEOAArgs {
        return obj !== null && obj !== undefined && typeof obj.privateKey == 'string' && super.isValidArgs(obj); 
    }

    execute(path: string) {
        // TODO:execute the forge script, get its output and sign it.
    }
    
    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const account = privateKeyToAccount(this.args.privateKey! as `0x${string}`);
        return await account.signTypedData({
            types: getEip712TxTypes(version) as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: this.args.safeAddress as `0x${string}`
            },
            primaryType: 'SafeTx',
            message: {
                ...txn.data,
                value: txn.data.value,
                safeTxGas: txn.data.safeTxGas,
                baseGas: txn.data.baseGas,
                gasPrice: txn.data.gasPrice,
                nonce: txn.data.nonce
            }
        })
    }

    async getSignerAddress(): Promise<string> {
        return privateKeyToAccount(this.args.privateKey! as `0x${string}`).address;
    }
}