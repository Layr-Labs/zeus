import { Strategy, TSignatureRequest, Txn } from "../strategy";

type TLedgerArgs = {};

export class LedgerSigningStrategy extends Strategy<TLedgerArgs> {
    id = "ledger";

    // coercion funciton for checking arg validity
    assertValidArgs(obj: any): obj is TLedgerArgs {
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
            deployedContracts: [],
            ready: false,
        }
    }

    async forgeArgs(): Promise<string[]> {
        return ["--ledger", "--sig", `"deploy()"`, "./deploy.json",];
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}