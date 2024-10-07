import { GnosisSigningStrategy } from "./gnosis.js";
import {SafeTransaction} from "@safe-global/safe-core-sdk-types";
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index.js"
import { LedgerSigner } from "@ethers-ext/signer-ledger";
import HIDTransport from "@ledgerhq/hw-transport-node-hid";
import { getDefaultProvider } from 'ethers'
 
const provider = getDefaultProvider() // TODO(multinetwork)

type TGnosisEOAArgs = {} // no additional args here.

export class GnosisLedgerStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.ledger";

    forgeArgs(): string[] {
        return ["--ledger"];
    }

    execute(path: string) {
        // TODO:execute the forge script, get its output and sign it.
    }

    isValidSubCommandArgs(obj: any): obj is TGnosisEOAArgs {
        return true;
    }
    
    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const signer = new LedgerSigner(HIDTransport, provider);
        const typedDataArgs = {
            types: getEip712TxTypes(version),
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
        };

        return await signer.signTypedData(
            typedDataArgs.domain,
            // @ts-expect-error - TODO:(typescript)
            typedDataArgs.types,
            typedDataArgs.message
        ) as `0x${string}`
    }

    async getSignerAddress(): Promise<string> {
        const signer = new LedgerSigner(HIDTransport, provider);
        return signer.getAddress();
    }
}