import EOABaseSigningStrategy from "./eoa";
import { getLedgerAccount } from "../ledgerTransport";
import { ICachedArg, TStrategyOptions } from "../../strategy";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';

export class LedgerSigningStrategy extends EOABaseSigningStrategy {
    id = "ledger";
    description = "Signing w/ ledger";

    public bip32Path: ICachedArg<string> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.bip32Path = this.arg(async () => {
            return await prompts.bip32Path();
        }, 'bip32path')
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        console.warn(`If your ledger is not working, you may need to open LedgerLive, navigate to: Accounts -> <Signer> -> Receive and follow the prompts on device. Once your Ledger says "Application is Ready", you can force quit LedgerLive and retry Zeus.`)
        const signer = await getLedgerAccount(await this.bip32Path.get());
        return await signer.address as `0x${string}`;
    }

    async subclassForgeArgs(): Promise<string[]> {
        const derivationPathArgs = await (async () => {
            try {
                const path = await this.bip32Path.getImmediately();
                return [`--mnemonic-derivation-paths`, path]
            } catch {
                return [];
            }
        })()
        return ["--ledger", ...derivationPathArgs];
    }
}