import { privateKeyToAccount } from "viem/accounts";
import { Strategy, TSignatureRequest } from "../strategy.js";
import { canonicalPaths } from "../../metadata/paths.js";
import { getRepoRoot } from "../../commands/inject.js";
import { basename } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";
import { parseTuples } from "./utils.js";

type TEOAArgs = {
    privateKey: string
    rpcUrl: string
};

export default class EOASigningStrategy extends Strategy<TEOAArgs> {
    id = "eoa";

    isValidArgs(obj: any): obj is TEOAArgs {
        if (obj.privateKey === undefined) {
             return false;
        }

        const pk = obj.privateKey?.startsWith("0x") ? obj : `0x${obj.privateKey}`;
        try {
            privateKeyToAccount(pk);
        } catch {
            return false;
        }

        if (!obj.rpcUrl) {
            return false;
        }

        return true;
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async forgeArgs(): Promise<string[]> {
        return ["--private-key", this.args.privateKey, '--broadcast', '--rpc-url', this.args.rpcUrl, '--sig', `deploy(string)`, await this.pathToDeployParamters()];
    }

    redactInOutput(): string[] {
        return [this.args.privateKey];
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const {output, chainId} = await this.runForgeScript(pathToUpgrade);
        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {name: tuple[0], address: tuple[1] as `0x${string}`}
        })
        const wallet = privateKeyToAccount(this.args.privateKey.startsWith('0x') ? this.args.privateKey as `0x${string}` : `0x${this.args.privateKey}`)
        console.log(chalk.italic(`Using wallet: ${wallet.address}`));

        const deployLatest = JSON.parse(readFileSync(canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), chainId!), {encoding: 'utf-8'}))
        const {timestamp, chain} = deployLatest;
        const runLatest = JSON.parse(readFileSync(canonicalPaths.forgeRunJson(getRepoRoot(), basename(pathToUpgrade), chain as number, timestamp), {encoding: 'utf-8'}))
        return { 
            forge: {
                runLatest,
                deployLatest
            },
            deployedContracts,
            ready: true,
        }
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}