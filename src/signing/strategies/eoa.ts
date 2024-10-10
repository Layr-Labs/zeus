import { privateKeyToAccount } from "viem/accounts";
import { Strategy, TSignatureRequest } from "../strategy.js";
import { canonicalPaths } from "../../metadata/paths.js";
import { getRepoRoot } from "../../commands/inject.js";
import { basename } from "path";
import { readFileSync } from "fs";

// TODO: not hardcode this =[
type TEOAArgs = {
    privateKey: string
    rpcUrl: string
};

function parseTuples(input: string): string[][] {
    const tupleRegex = /\((\w+),\s(0x[a-fA-F0-9]+)\)/g;
    const result: string[][] = [];
    let match;

    // Use regex to extract all tuples
    while ((match = tupleRegex.exec(input)) !== null) {
        result.push([match[1], match[2]]);
    }

    return result;
}

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