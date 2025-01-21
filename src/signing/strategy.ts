import chalk from 'chalk';
import { parseForgeOutput, runWithArgs, TForgeOutput, TForgeRun } from './utils';
import { SavebleDocument, Transaction } from '../metadata/metadataStore';
import tmp from 'tmp';
import ora from 'ora';
import { TDeploy, TDeployedContractSparse } from '../metadata/schema';
import { injectableEnvForEnvironment } from '../commands/run';
import { AnvilService } from '@foundry-rs/hardhat-anvil/dist/src/anvil-service';
import { TestClient } from 'viem';

tmp.setGracefulCleanup();

export interface Txn {
    calldata: `0x${string}`
    to: `0x${string}`
}

export interface HasStateUpdates {
    stateUpdates: {
        value: unknown;
        name: string;
        internalType: number;
    }[]
}

// check the transactions created by the previous step.
export interface TFoundryDeploy {
    transactions: {
        hash: `0x${string}`
    }[] | undefined;
}

export interface TForgeRequest extends HasStateUpdates {
    output: TForgeRun; 

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

export interface TGnosisRequest extends HasStateUpdates {
    safeAddress: `0x${string}`,
    safeTxHash: `0x${string}`,
    senderAddress: `0x${string}`,
    signature?: `0x${string}`
    immediateExecution?: {
        transaction: `0x${string}` | undefined,
        success: boolean,
        simulation?: unknown
    }
}

export interface TSignedGnosisRequest extends TGnosisRequest {
    signature: `0x${string}`
}

export type TSignatureRequest = TForgeRequest | TGnosisRequest;

export type TForkType = 'anvil' | 'tenderly';

export interface TExecuteOptions {
    nonInteractive?: boolean,
    fork?: TForkType,
    etherscanApiKey?: string | boolean,
    bip32path?: string,
    anvil?: AnvilService,
    testClient?: TestClient,
    rpcUrl?: string,
    overrideEoaPk?: `0x${string}`
}

function redact(haystack: string, ...needles: string[]) {
    let out = haystack;
    for (const needle of needles) {
        out = out.replaceAll(needle, chalk.bold('<redacted>'));
    }
    return out;
}

export interface ICachedArg<T> {
    get: () => Promise<T>
    getImmediately: () => T
}

class CachedArg<T> implements ICachedArg<T> {
    cachedValue: T | undefined;
    _get: () => Promise<T>
    throwOnUnset: boolean;

    constructor(cachedValue: T | undefined, get: () => Promise<T>, throwOnUnset: boolean) {
        this.cachedValue = cachedValue;
        this._get = get;
        this.throwOnUnset = throwOnUnset;
    }

    getImmediately(): T {
        if (this.cachedValue === undefined) {
            throw new Error(`Required interaction, but requested non-interactive argument.`);
        }

        return this.cachedValue;
    }

    async get(): Promise<T> {
        if (!this.cachedValue) {
            this.cachedValue = await this._get();
        }

        return this.cachedValue;        
    }
}

export class PauseDeployError extends Error {
    readonly phase: string;
    readonly segmentId: number;
    readonly deploy: string;

    constructor(deploy: SavebleDocument<TDeploy>, reason: string) {
        super(`The deploy stopped: ${reason}`);
        this.phase = deploy._.phase;
        this.deploy = deploy._.name;
        this.segmentId = deploy._.segmentId;
    }
}

export class HaltDeployError extends Error {
    readonly phase: string;
    readonly segmentId: number;
    readonly deploy: string;
    readonly complete: boolean;

    constructor(deploy: SavebleDocument<TDeploy>, reason: string, complete = false) {
        super(`The deploy halted: ${reason}`);
        this.phase = deploy._.phase;
        this.deploy = deploy._.name;
        this.segmentId = deploy._.segmentId;
        this.complete = complete ?? false;
    }
}

export interface TStrategyOptions { 
    defaultArgs?: TExecuteOptions,
    nonInteractive?: boolean,
};

export abstract class Strategy {
    readonly deploy: SavebleDocument<TDeploy>;
    readonly metatxn: Transaction;
    readonly defaultArgs: TExecuteOptions; // pre-seeded args, to avoid user interaction.
    readonly nonInteractive: boolean;
    readonly options: TStrategyOptions | undefined;

    arg<T>(getFn: () => Promise<T>, key?: keyof TExecuteOptions): ICachedArg<T> {
        const defaultValue = key ? this.defaultArgs[key] : undefined;
        return new CachedArg<T>(defaultValue as T, getFn, this.nonInteractive);
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

    async runForgeScript(path: string, _args?: {isPrepare?: boolean, verbose?: boolean}): Promise<TForgeOutput> {
        const customForgeArgs = _args?.isPrepare ? await this.forgeDryRunArgs() : await this.forgeArgs();
        const args = ['script', path, ...customForgeArgs, '--json'];

        const prompt = ora(`Running: ${chalk.italic(`forge ${redact(args.join(' '), ...await this.redactInOutput())}`)}`);
        const spinner = prompt.start();
        
        // when we run scripts, we inject;
        //  1- the latest available environment, and
        //  2- any additional scripts deployed on top.
        const latestEnv = await injectableEnvForEnvironment(this.metatxn, this.deploy._.env, this.deploy._.name);

        try {
            const {code, stdout, stderr} = await runWithArgs('forge', args, {
                ...latestEnv
            }, _args?.verbose);
            if (code !== 0) {
                throw new Error(`Forge script failed with code ${code}: ${stderr}`);
            }
            spinner.stop();

            return parseForgeOutput(stdout);
        } catch (e) {
            spinner.stopAndPersist();  
            throw e;
        } 
    }

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        this.metatxn = transaction;
        this.deploy = deploy;
        this.options = options;
        this.defaultArgs = options?.defaultArgs ?? {};
        this.nonInteractive = !!options?.nonInteractive;
    } 
}