import { privateKeyToAccount } from "viem/accounts";
import { GnosisSigningStrategy } from "./api";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { checkShouldSignGnosisMessage, privateKey } from "../../../../commands/prompts";

interface TGnosisEOAArgs {
    privateKey: string;
}

export class GnosisEOAStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id = "gnosis.api.eoa";
    description = "[Not Private] Gnosis SAFE - signing w/ private key using Gnosis API";

    public async promptSubStrategyArgs(): Promise<TGnosisEOAArgs> {
        const pk = await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE');
        return {
            privateKey: pk
        }
    }

    async redactInOutput(): Promise<string[]> {
        const args = await this.args();
        return [args.privateKey];
    }

    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const args = await this.args();
        const account = privateKeyToAccount(args.privateKey as `0x${string}`);
        const types = getEip712TxTypes(version);
        const typedDataParameters = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: args.safeAddress as `0x${string}`,
                chainId: this.deploy._.chainId,
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

        await checkShouldSignGnosisMessage(typedDataParameters);
        return await account.signTypedData(typedDataParameters)
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        const args = await this.args();
        return privateKeyToAccount(args.privateKey as `0x${string}`).address;
    }
}