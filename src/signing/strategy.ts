import chalk from 'chalk';
import { spawn } from 'child_process';
import { TDeploy } from '../commands/deploy/cmd/utils.js';
import { MetadataStore } from '../metadata/metadataStore.js';
import { canonicalPaths } from '../metadata/paths.js';
import { getRepoRoot } from '../commands/inject.js';

export type Txn = {
    calldata: `0x${string}`
    to: `0x${string}`
}

export interface TSignatureRequest {
    // Any RLP encoded signed-txns
    signedTransactions?: `0x${string}`[] | undefined,

    // any contracts known to have been deployed by this operation.
    deployedContracts?: Record<string, `0x${string}`> | undefined,

    ready: boolean,
    poll: (args?: {timeoutMs: number}) => Promise<TSignatureRequest>
}

// TODO: signing strategy should inject node / publicClient
export abstract class Strategy<TArgs> {
    readonly args: TArgs;

    readonly deploy: TDeploy;
    readonly metadata: MetadataStore;

    // coercion funciton for checking arg validity
    abstract isValidArgs(obj: any): obj is TArgs;

    // name of the signing strategy. should be unique.
    abstract id: string;

    // trigger the signing process for the given upgrade script.
    //
    // NOTE: this WILL side effects 
    //      - (e.g in the case of a gnosis multisig proposal, an api request), or
    //      - (e.g in the case of an EOA deploy, the literal deploy).
    //
    //      Any state produced from this should be checked in.
    abstract requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined>;

    // lets sub-scripts inject args.
    //  e.g the EOA will run '-s', 
    abstract forgeArgs(): Promise<string[]>;

    async pathToDeployParamters(): Promise<string> {
        return await this.metadata.getJSONPath(canonicalPaths.deployDirectory(
            getRepoRoot(),
            this.deploy.env,
            this.deploy.upgrade,
        ))
    }

    async runForgeScript(path: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const args = ['script', path, ...await this.forgeArgs(), '--json'];
            console.log(chalk.italic(`Running: forge ${args.join(' ')}`))
            const child = spawn('forge', args);

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

    // pollable method to check whether the latest requested signature completed or not. if it completed,
    // returns the signed value. `poll()`
    abstract latest(): Promise<TSignatureRequest | undefined>;

    constructor(deploy: TDeploy, options: Record<string, any>, metadataStore: MetadataStore) {
        this.deploy = deploy;
        this.metadata = metadataStore;
        if (!this.isValidArgs(options)) {
            throw new Error(`Missing required arguments for signing strategy: ${this.constructor.name}`);
        }
        this.args = options;
    } 
}