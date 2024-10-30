import { Strategy, TSignatureRequest } from "../../strategy";
import { canonicalPaths } from "../../../metadata/paths";
import { getRepoRoot } from '../../../commands/configs';
import { basename } from "path";
import { existsSync, readFileSync } from "fs";
import chalk from "chalk";
import { parseTuples } from "../utils";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';

interface TBaseEOAArgs {
    rpcUrl: string
}

interface TForgeRun {
    timestamp: number,
    chain: number, 
    transactions: {transaction: {from: string}}[]
}

export default abstract class EOABaseSigningStrategy<T> extends Strategy<TBaseEOAArgs & T> {

    abstract promptSubArgs(): Promise<T>;
    abstract subclassForgeArgs(): Promise<string[]>;
    abstract getSignerAddress(): Promise<`0x${string}`>;

    async promptArgs(): Promise<TBaseEOAArgs & T> {
        const subargs = await this.promptSubArgs();
        const rpcUrl = await prompts.rpcUrl(this.deploy._.chainId);
        return {
            ...subargs,
            rpcUrl: rpcUrl,
        }
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async forgeArgs(): Promise<string[]> {
        const args = await this.args();
        const subclassForgeArgs = await this.subclassForgeArgs();

        return [...subclassForgeArgs, '--broadcast', '--rpc-url', args.rpcUrl, '--sig', `deploy()`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        const args = await this.args();
        const subclassForgeArgs = await this.subclassForgeArgs();

        return [...subclassForgeArgs, '--rpc-url', args.rpcUrl, '--sig', `deploy()`];
    }

    async cancel(): Promise<void> {
        throw new Error('EOA deploys cannot be cancelled.');
    }

    async prepare(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade, true /* dryRun */);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {contract: tuple[0], address: tuple[1] as `0x${string}`, singleton: tuple[2] === 'true'}
        })

        let runLatest: TForgeRun | undefined = undefined;
        let deployLatest: TForgeRun | undefined = undefined;
        const signer = await this.getSignerAddress();

        const deployLatestPath = canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), deploy.chainId);
        if (!existsSync(deployLatestPath)) {
            console.warn(`This deploy did not broadcast any new contracts. If this was intended, you can ignore this.`);
            if (Object.keys(deployedContracts).length > 0) {
                console.error(`HIGH: The 'deployments' returned from this script were non-zero (${Object.keys(deployedContracts).length}), but forge did not broadcast anything.`);
            }
        } else {
            deployLatest = JSON.parse(readFileSync(deployLatestPath, {encoding: 'utf-8'})) as TForgeRun;
            const {timestamp, chain} = deployLatest;
            runLatest = JSON.parse(readFileSync(canonicalPaths.forgeRunJson(getRepoRoot(), basename(pathToUpgrade), chain as number, timestamp), {encoding: 'utf-8'})) as TForgeRun
            const signer = deployLatest?.transactions[0]?.transaction?.from;
            console.log(chalk.italic(`Using wallet: ${signer}`));
        }

        return { 
            forge: {
                runLatest,
                deployLatest
            },
            signer,
            deployedContracts,
            ready: true,
        }
    }

    async requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {contract: tuple[0], address: tuple[1] as `0x${string}`, singleton: tuple[2] === 'true'}
        })

        let runLatest: TForgeRun | undefined = undefined;
        let deployLatest: TForgeRun | undefined = undefined;
        const signer = await this.getSignerAddress();

        const deployLatestPath = canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), deploy.chainId);
        if (!existsSync(deployLatestPath)) {
            console.warn(`This deploy did not broadcast any new contracts. If this was intended, you can ignore this.`);
            if (Object.keys(deployedContracts).length > 0) {
                console.error(`HIGH: The 'deployments' returned from this script were non-zero (${Object.keys(deployedContracts).length}), but forge did not broadcast anything.`);
            }
        } else {
            deployLatest = JSON.parse(readFileSync(deployLatestPath, {encoding: 'utf-8'})) as TForgeRun;
            const {timestamp, chain} = deployLatest;
            runLatest = JSON.parse(readFileSync(canonicalPaths.forgeRunJson(getRepoRoot(), basename(pathToUpgrade), chain as number, timestamp), {encoding: 'utf-8'})) as TForgeRun
            const signer = deployLatest?.transactions[0]?.transaction?.from;
            console.log(chalk.italic(`Using wallet: ${signer}`));
        }

        return { 
            forge: {
                runLatest,
                deployLatest
            },
            signer,
            deployedContracts,
            ready: true,
        }
    }
}