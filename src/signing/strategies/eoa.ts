import { privateKeyToAccount } from "viem/accounts";
import { Strategy, TSignatureRequest } from "../strategy";
import { canonicalPaths } from "../../metadata/paths";
import { getRepoRoot } from "../../commands/inject";
import { basename } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";
import { parseTuples } from "./utils";
import { TDeploy } from "../../metadata/schema";

type TEOAArgs = {
    privateKey: string
    rpcUrl: string
};

export default class EOASigningStrategy extends Strategy<TEOAArgs> {
    id = "eoa";

    assertValidArgs(obj: any): obj is TEOAArgs {
        if (obj.privateKey === undefined) {
            throw new Error(`Missing --privateKey`)
        }

        const pk = obj.privateKey?.startsWith("0x") ? obj.privateKey : `0x${obj.privateKey}`;
        try {
            privateKeyToAccount(pk);
        } catch (e) {
            throw new Error(`Invalid --privateKey: ${e}`)
        }

        if (!obj.rpcUrl) {
            throw new Error(`Invalid --rpcUrl`)
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

    async requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const {output} = await this.runForgeScript(pathToUpgrade);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {name: tuple[0], address: tuple[1] as `0x${string}`}
        })
        const wallet = privateKeyToAccount(this.args.privateKey.startsWith('0x') ? this.args.privateKey as `0x${string}` : `0x${this.args.privateKey}`)
        console.log(chalk.italic(`Using wallet: ${wallet.address}`));

        const deployLatest = JSON.parse(readFileSync(canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), deploy.chainId!), {encoding: 'utf-8'}))
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