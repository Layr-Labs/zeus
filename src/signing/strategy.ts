import chalk from 'chalk';
import { spawn } from 'child_process';
import { MetadataStore } from '../metadata/metadataStore';
import { canonicalPaths } from '../metadata/paths';
import tmp from 'tmp';
import fs from 'fs';
import ora from 'ora';
import { TDeploy } from '../metadata/schema';

tmp.setGracefulCleanup();

export type Txn = {
    calldata: `0x${string}`
    to: `0x${string}`
}

type TForgeOutput = {
    output: any
    chainId: number | undefined
}

export interface TForgeRequest {
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

export interface TGnosisRequest {
    safeAddress: string,
    safeTxHash: string,
    senderAddress: `0x${string}`,
    signature: `0x${string}`
}

export type TSignatureRequest = TForgeRequest | TGnosisRequest;

type Result = {
    stdout: string;
    stderr: string;
    code: number;       
}

function redact(haystack: string, ...needles: string[]) {
    let out = haystack;
    for (let needle of needles) {
        out = out.replaceAll(needle, chalk.bold('<redacted>'));
    }
    return out;
}


// TODO: signing strategy should inject node / publicClient
export abstract class Strategy<TArgs> {
    readonly deploy: TDeploy;
    readonly metadata: MetadataStore;
    readonly options: Record<string, any>;

    public get args(): TArgs {
        if (!this.isValidArgs(this.options)) {
            throw new Error(`Missing required arguments for signing strategy: ${this.constructor.name} ${this.usage() ? `(Usage: ${this.usage()})` : ''}`);
        }
        return this.options;
    }

    usage(): string {
        return '';
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

    // any important data to redact in output.
    redactInOutput(): string[] {
        return [];
    }

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

    // for mocking.
    static runWithArgs(cmd: string, args: string[]): Promise<Result> {
        return new Promise((resolve, reject) => {
            try {
                const child = spawn(cmd, args, {stdio: 'pipe'});

                let stdoutData = '';
                let stderrData = '';

                child.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });

                child.stderr.on('data', (data) => {
                    stderrData += data.toString();
                });

                child.on('close', (code) => {
                    if (code != 0) {
                        reject({stdout: stdoutData, code, stderr: stderrData})
                    } else {
                        resolve({stdout: stdoutData, code, stderr: stderrData})
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async runForgeScript(path: string): Promise<TForgeOutput> {
        return new Promise(async (resolve, reject) => {
            try {
                var chainId: number | undefined = undefined;
                const args = ['script', path, ...await this.forgeArgs(), '--json'];

                const prompt = ora(`Running: ${chalk.italic(`forge ${redact(args.join(' '), ...this.redactInOutput())}`)}`);
                const spinner = prompt.start();

                const {code, stdout, stderr} = await Strategy.runWithArgs('forge', args);
                spinner.stop();
                if (code !== 0) {
                    return reject(new Error(`Forge script failed with code ${code}: ${stderr}`));
                }

                // Search for the first line that begins with '{' (--json output)
                const lines = stdout.split('\n');
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
            } catch (e) {
                reject(e);
            }
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