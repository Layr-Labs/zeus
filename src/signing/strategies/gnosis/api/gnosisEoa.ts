import { privateKeyToAccount } from "viem/accounts";
import { GnosisApiStrategy } from "./gnosisApi";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { checkShouldSignGnosisMessage, privateKey, signerKey } from "../../../../commands/prompts";
import { ICachedArg, TStrategyOptions } from "../../../strategy";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";

export class GnosisEOAApiStrategy extends GnosisApiStrategy {
    id = "gnosis.api.eoa";
    description = "Gnosis API - Private Key (Not For Private Hotfixes)";
    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options: TStrategyOptions | undefined) {
        super(deploy, transaction, options);
        this.privateKey = this.arg(async () => {
            if (!this.forMultisig) {
                return await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE')
            } else {
                // we know which SAFE this is for, so we can filter for owners of that specifically.
                return await signerKey(deploy._.chainId, await this.rpcUrl.get(), `Enter the private key of a signer for your SAFE(${this.forMultisig})`, this.forMultisig)
            }
        }, 'overrideEoaPk')
    } 

    async redactInOutput(): Promise<string[]> {
        try {
            // NOTE: if getImmediately() doesn't return anything, then there is not yet anything _to_ redact...
            // you just can't cache the result of this call.
            return [this.privateKey.getImmediately()]
        } catch {
            return [];
        }
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