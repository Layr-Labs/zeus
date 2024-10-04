import { GnosisSigningStrategy } from "./gnosis.js";
import {SafeTransaction} from "@safe-global/safe-core-sdk-types";

type TGnosisEOAArgs = {} // no additional args here.

export class GnosisLedgerStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.ledger";

    forgeArgs(): string[] {
        return [];
    }

    execute() {
        
    }

    isValidSubCommandArgs(obj: any): obj is TGnosisEOAArgs {
        return true; // no additional args.
    }

    async getTransactionHash(txn: SafeTransaction): Promise<`0x${string}`> {
        throw new Error('unimplemented.');
    }
    
    async getSignature(txn: SafeTransaction): Promise<`0x${string}`> {
        throw new Error('unimplemented.');
    }

    async getSignerAddress(): Promise<string> {
        throw new Error('unimplemented.');
    }
}