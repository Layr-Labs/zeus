import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";

export class EOASigningStrategy extends SigningStrategy {
    id = "eoa";

    requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}