import { privateKeyToAccount } from "viem/accounts";
import { GnosisApiStrategy } from "./gnosisApi";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { checkShouldSignGnosisMessage, privateKey } from "../../../../commands/prompts";
import { ICachedArg, TStrategyOptions } from "../../../strategy";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";

export class GnosisEOAApiStrategy extends GnosisApiStrategy {
    id = "gnosis.api.eoa";
    description = "[Not Private] Gnosis SAFE - signing w/ private key using Gnosis API";
    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options: TStrategyOptions) {
        super(deploy, transaction, options);
        this.privateKey = this.arg(async () => await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE'))
    } 

    async redactInOutput(): Promise<string[]> {
        return [await this.privateKey.get()];
    }

    async getSignature(version: string, txn: SafeTransaction, safeAddress: `0x${string}`): Promise<`0x${string}`> {
        const account = privateKeyToAccount(await this.privateKey.get() as `0x${string}`);
        const types = getEip712TxTypes(version);
        const typedDataParameters = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: safeAddress as `0x${string}`,
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
        return privateKeyToAccount(await this.privateKey.get() as `0x${string}`).address;
    }
}