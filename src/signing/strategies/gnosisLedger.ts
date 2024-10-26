import { GnosisSigningStrategy } from "./gnosis";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { LedgerSigner } from "@ethers-ext/signer-ledger";
import HIDTransport from "@ledgerhq/hw-transport-node-hid";
import { getDefaultProvider } from 'ethers'
 
const provider = getDefaultProvider() // TODO(multinetwork)
type TGnosisLedgerArgs = unknown;

export class GnosisLedgerStrategy extends GnosisSigningStrategy<TGnosisLedgerArgs> {
    id = "gnosis.ledger";
    description = "Gnosis SAFE - signing w/ ledger";

    async forgeArgs(): Promise<string[]> {
        return ["--ledger"];
    }

    public async promptSubStrategyArgs(): Promise<TGnosisLedgerArgs> {
        return {};
    }
    
    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const signer = new LedgerSigner(HIDTransport, provider);
        const args = await this.args();
        const typedDataArgs = {
            types: getEip712TxTypes(version),
            domain: {
                verifyingContract: args.safeAddress as `0x${string}`
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
        };

        return await signer.signTypedData(
            typedDataArgs.domain,
            // @ts-expect-error - TODO:(typescript)
            typedDataArgs.types,
            typedDataArgs.message
        ) as `0x${string}`
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        const signer = new LedgerSigner(HIDTransport, provider);
        return await signer.getAddress() as `0x${string}`;
    }
}