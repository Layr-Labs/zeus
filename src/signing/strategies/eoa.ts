import { privateKeyToAccount } from "viem/accounts";
import { Strategy, TSignatureRequest, Txn } from "../strategy.js";

type TEOAArgs = {
    privateKey: string
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

        return true;
    }

    async forgeArgs(): Promise<string[]> {
        return ["--private-key", this.args.privateKey, '--sig', `deploy(string)`, await this.pathToDeployParamters()];
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const output = await this.runForgeScript(pathToUpgrade);
        console.log(output);
        // TODO: parse the output.
        // TODO: parse updated contract addresses json.
        // TODO: update metadata repo.
        return { 
            signedTransactions: [],
            deployedContracts: {},
            ready: false,
            poll: async () => {return {ready: false, poll: () => {throw new Error('unimplemented')}}}
        }
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}