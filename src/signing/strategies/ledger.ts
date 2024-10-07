import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";

type TLedgerArgs = {};

export class LedgerSigningStrategy extends SigningStrategy<TLedgerArgs> {
    id = "ledger";

    // coercion funciton for checking arg validity
    isValidArgs(obj: any): obj is TLedgerArgs {
        return true;
    }

    execute(path: string): void {
        // TODO: run an EOA script and sign/broadcast with ledger.
        throw new Error('unsupported');
    }

    // lets sub-scripts inject args.
    //  e.g the EOA will run '-s', 
    forgeArgs(): string[] {
        return [];
    }

    requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}