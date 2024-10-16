import { privateKeyToAccount } from "viem/accounts";
import { GnosisSigningStrategy } from "./gnosis";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { SEPOLIA_CHAIN_ID } from "./utils";
import { privateKey } from "../../commands/prompts";

type TGnosisEOAArgs = {
    privateKey: string;
}

export class GnosisEOAStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.eoa";
    description: string = "Gnosis SAFE - signing w/ private key";
    
    async forgeArgs(): Promise<string[]> {
        const args = await this.args();
        return ["--private-key", args.privateKey, ...await super.forgeArgs()];
    }

    public async promptSubStrategyArgs(): Promise<TGnosisEOAArgs> {
        const pk = await privateKey();
        return {
            privateKey: pk!
        }
    }

    async redactInOutput(): Promise<string[]> {
        const args = await this.args();
        return [args.privateKey];
    }

    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const args = await this.args();
        const account = privateKeyToAccount(args.privateKey! as `0x${string}`);
        const types = getEip712TxTypes(version);
        const typedDataParameters = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: args.safeAddress as `0x${string}`,
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
        const args = await this.args();
        return privateKeyToAccount(args.privateKey! as `0x${string}`).address;
    }
}