import EOABaseSigningStrategy from "./eoa";
import { getLedgerAccount } from "../ledgerTransport";
import { ICachedArg, TStrategyOptions } from "../../strategy";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';
import { DEFAULT_BASE_DERIVATION_PATH } from "../ledgerTransport";

export class LedgerSigningStrategy extends EOABaseSigningStrategy {
    id = "ledger";
    description = "Signing w/ ledger";

    public accountIndex: ICachedArg<number> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.accountIndex = this.arg(async () => {
            return await prompts.accountIndex();
        }, 'accountIndex')
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        console.warn(`If your ledger is not working, you may need to open LedgerLive, navigate to: Accounts -> <Signer> -> Receive and follow the prompts on device. Once your Ledger says "Application is Ready", you can force quit LedgerLive and retry Zeus.`)
        const signer = await getLedgerAccount(await this.accountIndex.get());
        return await signer.address as `0x${string}`;
    }

    async subclassForgeArgs(): Promise<string[]> {
        const derivationPathArgs = await (async () => {
            try {
                const accountIndex = await this.accountIndex.getImmediately();
                return [`--mnemonic-derivation-paths`, `${DEFAULT_BASE_DERIVATION_PATH}/${accountIndex}`]
            } catch {
                return [];
            }
        })()
        return ["--ledger", ...derivationPathArgs];
    }
}