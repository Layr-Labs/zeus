
export type Txn = {
    calldata: `0x${string}`
    to: `0x${string}`
}

export interface TSignatureRequest {
    // RLP encoded signed-txn
    signedTransaction: `0x${string}` | undefined,

    poll: (args?: {timeoutMs: number}) => Promise<`0x${string}`>
}

// TODO: signing strategy should inject node / publicClient
export abstract class SigningStrategy {
    options: Record<string, any>;

    // name of the signing strategy. should be unique.
    abstract id: string;

    // sign some calldata
    //
    // NOTE: this may have side effects (e.g in the case of a gnosis multisig proposal)
    //       if `signTransaction` can have side effects, it's expected that this should be
    //       idempotent/resumable, and rely on `ZEUS_HOST`/temp files for state-tracking.
    abstract requestNew(txns: Txn[]): Promise<TSignatureRequest>;

    // pollable method to check whether the latest requested signature completed or not. if it completed,
    // returns the signed value. `poll()`
    abstract latest(): Promise<TSignatureRequest | undefined>;

    constructor(options: Record<string, any>) {
        this.options = options;
    } 
}