import { Strategy, TSignatureRequest } from "../strategy";

type TLedgerArgs = unknown;

export class LedgerSigningStrategy extends Strategy<TLedgerArgs> {
    id = "ledger";
    description = "Signing w/ ledger";

    async promptArgs(): Promise<TLedgerArgs> {
        return {};
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
            signer: '0x0'
        }
    }

    async cancel(): Promise<void> {
        throw new Error('Ledger deploys cannot be cancelled.');
    }

    async forgeArgs(): Promise<string[]> {
        return ["--ledger", "--sig", `"deploy()"`, "./deploy.json",];
    }
}