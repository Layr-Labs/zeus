import { SigningStrategy, Txn } from "../signingStrategy.js";


export class GnosisSigningStrategy extends SigningStrategy {

    // name of the signing strategy. should be unique.
    id = "gnosis";

    // sign some calldata
    signTransactions(txns: Txn[]): Promise<`0x${string}`> {
        throw new Error('unimplemented');
    }
}