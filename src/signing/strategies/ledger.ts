import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";

type TLedgerArgs = {};

export class LedgerSigningStrategy extends SigningStrategy<TLedgerArgs> {
    id = "ledger";

    // coercion funciton for checking arg validity
    isValidArgs(obj: any): obj is TLedgerArgs {
        return true;
    }

    async requestNew(path: string): Promise<TSignatureRequest | undefined> {
        const output = await this.runForgeScript(path);
        console.log(output);
        // TODO: parse the output.
        // TODO: parse updated contract addresses json.
        // TODO: update metadata repo.
        return { 
            signedTransactions: [],
            deployedContracts: {},
            ready: false,
            poll: async () => {throw new Error('unimplemented')}
        }
    }

    forgeArgs(): string[] {
        return ["--ledger", `"execute(string memory)"`, "./deploy.json",];
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}