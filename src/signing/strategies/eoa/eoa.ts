import { ICachedArg, Strategy, TSignatureRequest, TStrategyOptions } from "../../strategy";
import { canonicalPaths } from "../../../metadata/paths";
import { getRepoRoot } from '../../../commands/configs';
import { basename } from "path";
import { existsSync, readFileSync } from "fs";
import chalk from "chalk";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';
import { TForgeRun } from "../../utils";
import { updateLatestDeploy } from "../../../commands/deploy/cmd/utils";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";


export default abstract class EOABaseSigningStrategy extends Strategy {

    public rpcUrl: ICachedArg<string> 
    public etherscanApiKey: ICachedArg<string | boolean> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.rpcUrl = this.arg(async () => {
            return await prompts.rpcUrl(this.deploy._.chainId);
        }, 'rpcUrl')
        this.etherscanApiKey = this.arg(async () => {
            if (options?.defaultArgs.fork) {
                return false;
            }

            const res = await prompts.etherscanApiKey();
            if (!res) {
                return false;
            }
            return res;
        }, 'etherscanApiKey');
    } 

    abstract subclassForgeArgs(): Promise<string[]>;
    abstract getSignerAddress(): Promise<`0x${string}`>;

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async redactInOutput(): Promise<string[]> {
        try {
            const etherscan = await this.etherscanApiKey.getImmediately();
            if (etherscan && typeof etherscan === 'string') {
                return [etherscan];
            }
        } catch {
            return [];
        };

        return [];
    }

    async forgeArgs(): Promise<string[]> {
        const etherscan = await this.etherscanApiKey.get();
        const rpcUrl = await this.rpcUrl.get();
        const subclassForgeArgs = await this.subclassForgeArgs();
        const etherscanVerify = (etherscan && typeof etherscan === 'string') ? [`--etherscan-api-key`,etherscan, `--chain`, `${this.deploy._.chainId}`, `--verify`] : [];
        return [...subclassForgeArgs, '--broadcast', '--slow', ...etherscanVerify, '--rpc-url', rpcUrl, '--sig', `runAsEOA()`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        const subclassForgeArgs = await this.subclassForgeArgs();
        const rpcUrl = await this.rpcUrl.get();
        return [...subclassForgeArgs, '--slow', '--rpc-url', rpcUrl, '--sig', `runAsEOA()`];
    }

    async cancel(): Promise<void> {
        this.deploy._.phase = 'cancelled';
        await updateLatestDeploy(this.metatxn, this.deploy._.env, undefined, true); 
    }

    async prepare(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates, contractDeploys} = await this.runForgeScript(pathToUpgrade, {isPrepare: true});
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const signer = await this.getSignerAddress();

        return { 
            forge: {
                runLatest: undefined,
                deployLatest: undefined,
            },
            stateUpdates,
            signer,
            deployedContracts: contractDeploys.map((ct) => {
                return {
                    address: ct.addr,
                    contract: ct.name,
                    singleton: ct.singleton
                }
            }),
            ready: true,
            output
        }
    }

    async requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output, stateUpdates, contractDeploys} = await this.runForgeScript(pathToUpgrade);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }
        
        let runLatest: TForgeRun | undefined = undefined;
        let deployLatest: TForgeRun | undefined = undefined;
        const signer = await this.getSignerAddress();

        const deployLatestPath = canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), deploy.chainId, 'runAsEOA');
        if (!existsSync(deployLatestPath)) {
            console.warn(`This deploy did not broadcast any new contracts. If this was intended, you can ignore this.`);
            if (Object.keys(contractDeploys).length > 0) {
                console.error(`HIGH: The 'deployments' returned from this script were non-zero (${Object.keys(contractDeploys).length}), but forge did not broadcast anything.`);
            }
        } else {
            deployLatest = JSON.parse(readFileSync(deployLatestPath, {encoding: 'utf-8'})) as TForgeRun;
            const {timestamp, chain} = deployLatest;
            runLatest = JSON.parse(readFileSync(canonicalPaths.forgeRunJson(getRepoRoot(), basename(pathToUpgrade), chain as number, timestamp), {encoding: 'utf-8'})) as TForgeRun
            const signer = deployLatest?.transactions[0]?.transaction?.from;
            console.log(chalk.italic(`using wallet: ${signer}`));
        }

        return { 
            output,
            stateUpdates,
            forge: {
                runLatest,
                deployLatest
            },
            signer,
            deployedContracts: contractDeploys.map((ct) => {
                return {
                    address: ct.addr,
                    contract: ct.name,
                    singleton: ct.singleton
                }
            }),
            ready: true,
        }
    }
}