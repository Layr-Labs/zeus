
export type Txn = {
    calldata: `0x${string}`
    to: `0x${string}`
}

export abstract class SigningStrategy {
    options: Record<string, any>;

    // name of the signing strategy. should be unique.
    abstract id: string;

    // sign some calldata
    abstract signTransactions(txns: Txn[]): Promise<`0x${string}`>;

    constructor(options: Record<string, any>) {
        this.options = options;
    } 
}