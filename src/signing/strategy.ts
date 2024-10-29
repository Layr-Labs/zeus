import chalk from 'chalk';
import { spawn } from 'child_process';
import { SavebleDocument, Transaction } from '../metadata/metadataStore';
import { canonicalPaths } from '../metadata/paths';
import tmp from 'tmp';
import fs from 'fs';
import ora from 'ora';
import { TDeploy, TDeployedContractSparse } from '../metadata/schema';
import { injectableEnvForEnvironment } from '../commands/run';

tmp.setGracefulCleanup();

export interface Txn {
    calldata: `0x${string}`
    to: `0x${string}`
}

interface TForgeOutput {
    output: {
        returns: {
            '0': {
                value: string;
            }
        }
    }
}

export interface TForgeRequest {
    forge?: {
        runLatest: unknown,
        deployLatest: unknown
    }

    signer: `0x${string}`
    // Any RLP encoded signed-txns
    signedTransactions?: `0x${string}`[] | undefined,

    // any contracts known to have been deployed by this operation.
    deployedContracts?: TDeployedContractSparse[] | undefined,

    ready: boolean,
}

export interface TGnosisRequest {
    safeAddress: `0x${string}`,
    safeTxHash: `0x${string}`,
    senderAddress: `0x${string}`,
    signature: `0x${string}`
}

export type TSignatureRequest = TForgeRequest | TGnosisRequest;

interface Result {
    stdout: string;
    stderr: string;
    code: number;       
}

function redact(haystack: string, ...needles: string[]) {
    let out = haystack;
    for (const needle of needles) {
        out = out.replaceAll(needle, chalk.bold('<redacted>'));
    }
    return out;
}


// TODO: signing strategy should inject node / publicClient
export abstract class Strategy<TArgs> {
    readonly deploy: SavebleDocument<TDeploy>;
    readonly metatxn: Transaction;

    public abstract promptArgs(): Promise<TArgs>;
    private _args: TArgs | undefined;

    public async args(): Promise<TArgs> {
        if (this._args === undefined) {
            this._args = await this.promptArgs();
        }

        return this._args;
    }

    usage(): string {
        return '';
    }

    // name of the signing strategy. should be unique.
    abstract id: string;
    abstract description: string;

    // trigger the signing process for the given upgrade script.
    //
    // NOTE: this WILL side effects 
    //      - (e.g in the case of a gnosis multisig proposal, an api request), or
    //      - (e.g in the case of an EOA deploy, the literal deploy).
    //
    //      Any state produced from this should be checked in.
    abstract requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined>;

    // try to cancel a deploy. not all strategies are cancellable.
    //
    abstract cancel(deploy: SavebleDocument<TDeploy>): Promise<void>;

    // lets sub-scripts inject args.
    //  e.g the EOA will run '-s', 
    abstract forgeArgs(): Promise<string[]>;

    // any important data to redact in output.
    async redactInOutput(): Promise<string[]> {
        return [];
    }

    async pathToDeployParamters(): Promise<string> {
        const paramsPath = canonicalPaths.deployParameters(
            '',
            this.deploy._.env,
        );
        const deployParametersContents = await this.metatxn.getJSONFile<Record<string, unknown>>(paramsPath) ?? {}
        const tmpFile = tmp.fileSync({dir: './', postfix: '.json', mode: 0o600});
        fs.writeFileSync(tmpFile.fd, JSON.stringify(deployParametersContents._));
        return tmpFile.name;
    }

    // for mocking.
    static runWithArgs(cmd: string, args: string[], env: Record<string, string>): Promise<Result> {
        return new Promise((resolve, reject) => {
            try {
                const child = spawn(cmd, args, {stdio: 'pipe', env: {
                    ...process.env,
                    ...env,
                }});

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
        // TODO: should we be running a forge clean?
        const args = ['script', path, ...await this.forgeArgs(), '--json'];

        const prompt = ora(`Running: ${chalk.italic(`forge ${redact(args.join(' '), ...await this.redactInOutput())}`)}`);
        const spinner = prompt.start();
        
        const latestEnv = await injectableEnvForEnvironment(this.metatxn, this.deploy._.env);


        try {
            const {code, stdout, stderr} = await Strategy.runWithArgs('forge', args, {
                ...latestEnv
            });
            if (code !== 0) {
                throw new Error(`Forge script failed with code ${code}: ${stderr}`);
            }

            // Search for the first line that begins with '{' (--json output)
            const lines = stdout.split('\n');
            const jsonLine = lines.find(line => line.trim().startsWith('{'));
            if (jsonLine) {
                try {
                    const parsedJson = JSON.parse(jsonLine);
                    return {output: parsedJson};
                } catch (e) {
                    throw new Error(`Failed to parse JSON: ${e}`);
                }
            } else {
                throw new Error('No JSON output found.');
            }
        } finally {
            spinner.stop();
        }
    }

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction) {
        this.deploy = deploy;
        this.metatxn = transaction;
    } 
}