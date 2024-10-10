import chalk from 'chalk';
import { spawn } from 'child_process';
import { TDeploy } from '../commands/deploy/cmd/utils.js';
import { MetadataStore } from '../metadata/metadataStore.js';
import { canonicalPaths } from '../metadata/paths.js';
import tmp from 'tmp';
import fs from 'fs';
import ora from 'ora';

tmp.setGracefulCleanup();

export type Txn = {
    calldata: `0x${string}`
    to: `0x${string}`
}

type TForgeOutput = {
    output: any
    chainId: number | undefined
}

export interface TSignatureRequest {
    forge?: {
        runLatest: any,
        deployLatest: any
    }
    // Any RLP encoded signed-txns
    signedTransactions?: `0x${string}`[] | undefined,

    // any contracts known to have been deployed by this operation.
    deployedContracts?: {name: string, address: `0x${string}`}[] | undefined,

    ready: boolean,
}

// TODO: signing strategy should inject node / publicClient
export abstract class Strategy<TArgs> {
    readonly deploy: TDeploy;
    readonly metadata: MetadataStore;
    readonly options: Record<string, any>;

    public get args(): TArgs {
        if (!this.isValidArgs(this.options)) {
            throw new Error(`Missing required arguments for signing strategy: ${this.constructor.name}`);
        }
        return this.options;
    }

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
        const paramsPath = canonicalPaths.deployParameters(
            '',
            this.deploy.env,
        );
        const deployParametersContents = await this.metadata.getJSONFile(paramsPath) ?? {}

        const tmpFile = tmp.fileSync({dir: './', postfix: '.json', mode: 0o600});
        fs.writeFileSync(tmpFile.fd, JSON.stringify(deployParametersContents));
        return tmpFile.name;
    }

    async runForgeScript(path: string): Promise<TForgeOutput> {
        return new Promise(async (resolve, reject) => {
            var chainId: number | undefined = undefined;
            const args = ['script', path, ...await this.forgeArgs(), '--json'];

            const prompt = ora(`Running: ${chalk.italic(`forge ${args.join(' ')}`)}`);
            const spinner = prompt.start();

            const child = spawn('forge', args, {stdio: 'pipe'});

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            child.on('close', (code) => {
                spinner.stop();
                if (code !== 0) {
                    return reject(new Error(`Forge script failed with code ${code}: ${stderrData}`));
                }

                // Search for the first line that begins with '{' (--json output)
                const lines = stdoutData.split('\n');
                const chainLine = lines.find(line => line.trim().startsWith('Chain'));
                if (chainLine) {
                    chainId = parseInt(chainLine.split(' ')[1])
                }
                const jsonLine = lines.find(line => line.trim().startsWith('{'));
                if (jsonLine) {
                    try {
                        const parsedJson = JSON.parse(jsonLine);
                        return resolve({output: parsedJson, chainId});
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
        this.options = options;
    } 
}