import {basename} from 'path';
import { spawn, spawnSync } from 'child_process';

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
export abstract class SigningStrategy<TArgs> {
    readonly args: TArgs;

    // coercion funciton for checking arg validity
    abstract isValidArgs(obj: any): obj is TArgs;

    // name of the signing strategy. should be unique.
    abstract id: string;

    abstract execute(path: string): void;

    // lets sub-scripts inject args.
    //  e.g the EOA will run '-s', 
    abstract forgeArgs(): string[];

    async runForgeScript(path: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const child = spawn('forge', ['script', path, ...this.forgeArgs(), '--json']);

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Forge script failed with code ${code}: ${stderrData}`));
                }

                // Search for the first line that begins with '{' (--json output)
                const lines = stdoutData.split('\n');
                const jsonLine = lines.find(line => line.trim().startsWith('{'));
                if (jsonLine) {
                    try {
                        const parsedJson = JSON.parse(jsonLine);
                        return resolve(parsedJson);
                    } catch (e) {
                        return reject(new Error(`Failed to parse JSON: ${e}`));
                    }
                } else {
                    return reject(new Error('No JSON output found.'));
                }
            });
        });
    }



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
        if (!this.isValidArgs(options)) {
            throw new Error('invalid arguments for signing strategy');
        }
        this.args = options;
    } 
}