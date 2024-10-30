import chalk from 'chalk';
import { runWithArgs } from './utils';
import { SavebleDocument, Transaction } from '../metadata/metadataStore';
import tmp from 'tmp';
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
    signature?: `0x${string}`
}

export interface TSignedGnosisRequest extends TGnosisRequest {
    signature: `0x${string}`
}

export type TSignatureRequest = TForgeRequest | TGnosisRequest;


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

    // return the dry run.
    abstract prepare(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined>;

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
    abstract forgeArgs(): Promise<string[]>;

    // lets sub-scripts inject args for a prepare / dry run.
    abstract forgeDryRunArgs(): Promise<string[]>;

    // any important data to redact in output.
    async redactInOutput(): Promise<string[]> {
        return [];
    }

    async runForgeScript(path: string, isPrepare = false): Promise<TForgeOutput> {
        // TODO: should we be running a forge clean?
        const customForgeArgs = isPrepare ? await this.forgeDryRunArgs() : await this.forgeArgs();
        const args = ['script', path, ...customForgeArgs, '--json'];

        const prompt = ora(`Running: ${chalk.italic(`forge ${redact(args.join(' '), ...await this.redactInOutput())}`)}`);
        const spinner = prompt.start();
        
        // when we run scripts, we inject;
        //  1- the latest available environment, and
        //  2- any additional scripts deployed on top.
        const latestEnv = await injectableEnvForEnvironment(this.metatxn, this.deploy._.env, this.deploy._.name);

        console.log(`Running with environment: `);
        console.log(JSON.stringify(latestEnv, null, 2));

        try {
            const {code, stdout, stderr} = await runWithArgs('forge', args, {
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