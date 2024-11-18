import { Strategy, TSignatureRequest } from "../../strategy";
import { canonicalPaths } from "../../../metadata/paths";
import { getRepoRoot } from '../../../commands/configs';
import { basename } from "path";
import { existsSync, readFileSync } from "fs";
import chalk from "chalk";
import { parseTuples } from "../utils";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';
import { getTrace, TForgeRun } from "../../utils";
import { updateLatestDeploy } from "../../../commands/deploy/cmd/utils";

interface TBaseEOAArgs {
    rpcUrl: string
    etherscanApiKey?: string,
}

export default abstract class EOABaseSigningStrategy<T> extends Strategy<TBaseEOAArgs & T> {

    abstract promptSubArgs(): Promise<T>;
    abstract subclassForgeArgs(): Promise<string[]>;
    abstract getSignerAddress(): Promise<`0x${string}`>;

    async promptArgs(): Promise<TBaseEOAArgs & T> {
        const subargs = await this.promptSubArgs();
        const rpcUrl = await prompts.rpcUrl(this.deploy._.chainId);
        const etherscanApiKey = await prompts.etherscanApiKey()

        return {
            ...subargs,
            rpcUrl: rpcUrl,
            etherscanApiKey,
        }
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async redactInOutput(): Promise<string[]> {
        const args = await this.args();
        if (args.etherscanApiKey) {
            return [args.etherscanApiKey];
        }

        return [];
    }

    async forgeArgs(): Promise<string[]> {
        const args = await this.args();
        const subclassForgeArgs = await this.subclassForgeArgs();
        const etherscanVerify = args.etherscanApiKey ? [`--etherscan-api-key`, args.etherscanApiKey, `--chain`, `${this.deploy._.chainId}`, `--verify`] : [];

        return [...subclassForgeArgs, '--broadcast', ...etherscanVerify, '--rpc-url', args.rpcUrl, '--sig', `deploy()`];
    }

    async forgeDryRunArgs(): Promise<string[]> {
        const args = await this.args();
        const subclassForgeArgs = await this.subclassForgeArgs();

        return [...subclassForgeArgs, '--rpc-url', args.rpcUrl, '--sig', `deploy()`];
    }

    async cancel(): Promise<void> {
        this.deploy._.phase = 'cancelled';
        await updateLatestDeploy(this.metatxn, this.deploy._.env, undefined, true); 
    }

    async prepare(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade, {isPrepare: true});
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const signer = await this.getSignerAddress();

        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            const addr = tuple[0] as `0x${string}`;
            const trace = getTrace(output, addr);
            if (!trace) {
                console.warn(`Failed to find deployment trace for deploy: ${addr}`);
                return;
            }
            return {address: tuple[0] as `0x${string}`, contract: tuple[1] as string, singleton: tuple[2] as boolean}
        }).filter(deployment => !!deployment) ?? [];

        return { 
            forge: {
                runLatest: undefined,
                deployLatest: undefined,
            },
            signer,
            deployedContracts,
            ready: true,
            output
        }
    }

    async requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }
        
        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {contract: tuple[1] as string, address: tuple[0] as `0x${string}`, singleton: tuple[2] as boolean}
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
            console.log(chalk.italic(`using wallet: ${signer}`));
        }

        return { 
            output: output,
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