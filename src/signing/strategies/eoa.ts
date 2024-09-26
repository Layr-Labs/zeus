import { SigningStrategy, Txn } from "../signingStrategy.js";

export class EOASigningStrategy extends SigningStrategy {

    // name of the signing strategy. should be unique.
    id = "eoa";

    // sign some calldata
    signTransactions(txns: Txn[]): Promise<`0x${string}`> {
        throw new Error('unimplemented');
    }
}