import { privateKeyToAccount } from "viem/accounts";
import { Strategy, TSignatureRequest } from "../strategy";
import { canonicalPaths } from "../../metadata/paths";
import { getRepoRoot } from '../../commands/configs';
import { basename } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";
import { parseTuples } from "./utils";
import { TDeploy } from "../../metadata/schema";
import * as prompts from '../../commands/prompts';

type TEOAArgs = {
    privateKey: string
    rpcUrl: string
};

export default class EOASigningStrategy extends Strategy<TEOAArgs> {
    id = "eoa";
    description: string = "Signing w/ private key";

    async promptArgs(): Promise<TEOAArgs> {
        const pk = await prompts.privateKey();
        const rpcUrl = await prompts.rpcUrl();
        return {
            privateKey: pk!,
            rpcUrl: rpcUrl!,
        }
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async forgeArgs(): Promise<string[]> {
        const args = await this.args();
        return ["--private-key", args.privateKey, '--broadcast', '--rpc-url', args.rpcUrl, '--sig', `deploy(string)`, await this.pathToDeployParamters()];
    }

    async redactInOutput(): Promise<string[]> {
        return [(await this.args()).privateKey];
    }

    async cancel(): Promise<void> {
        throw new Error('EOA deploys cannot be cancelled.');
    }

    async requestNew(pathToUpgrade: string, deploy: TDeploy): Promise<TSignatureRequest | undefined> {
        const args = await this.args();
        const {output} = await this.runForgeScript(pathToUpgrade);
        if (!output) {
            throw new Error(`Forge output was missing: (chainId=${deploy.chainId},output=${output})`);
        }

        const deployedContracts = parseTuples(output.returns['0'].value).map((tuple) => {
            return {contract: tuple[0], address: tuple[1] as `0x${string}`}
        })
        const wallet = privateKeyToAccount(args.privateKey.startsWith('0x') ? args.privateKey as `0x${string}` : `0x${args.privateKey}`)
        console.log(chalk.italic(`Using wallet: ${wallet.address}`));

        const deployLatest = JSON.parse(readFileSync(canonicalPaths.forgeDeployLatestMetadata(getRepoRoot(), basename(pathToUpgrade), deploy.chainId!), {encoding: 'utf-8'}))
        const {timestamp, chain} = deployLatest;
        const runLatest = JSON.parse(readFileSync(canonicalPaths.forgeRunJson(getRepoRoot(), basename(pathToUpgrade), chain as number, timestamp), {encoding: 'utf-8'}))
        return { 
            forge: {
                runLatest,
                deployLatest
            },
            signer: wallet.address,
            deployedContracts,
            ready: true,
        }
    }
}