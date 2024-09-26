import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";

export class LedgerSigningStrategy extends SigningStrategy {
    id = "ledger";

    requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}