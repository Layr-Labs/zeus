import { SigningStrategy, TSignatureRequest, Txn } from "../signingStrategy.js";

type TEOAArgs = {};

export class EOASigningStrategy extends SigningStrategy<TEOAArgs> {
    id = "eoa";

    execute(path: string): void {

    }

    isValidArgs(obj: any): obj is TEOAArgs {
        return true;
    }

    forgeArgs(): string[] {
        return [`"execute(string memory)"`, "./deploy.json",];
    }

    requestNew(txns: Txn[]): Promise<TSignatureRequest> {
        throw new Error('unimplemented');
    }

    latest(): Promise<TSignatureRequest | undefined> {
        throw new Error('unimplemented');
    }
}