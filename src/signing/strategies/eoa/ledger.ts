import EOABaseSigningStrategy from "./eoa";
import { getLedgerSigner } from "../ledgerTransport";
import { JsonRpcProvider } from "ethers";
import { ICachedArg, TStrategyOptions } from "../../strategy";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TDeploy } from "../../../metadata/schema";
import * as prompts from '../../../commands/prompts';

export class LedgerSigningStrategy extends EOABaseSigningStrategy {
    id = "ledger";
    description = "Signing w/ ledger";

    public derivationPath: ICachedArg<string | boolean> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.derivationPath = this.arg(async () => {
            return await prompts.derivationPath();
        }, 'derivationPath')
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        console.warn(`If your ledger is not working, you may need to open LedgerLive, navigate to: Accounts -> <Signer> -> Receive and follow the prompts on device. Once your Ledger says "Application is Ready", you can force quit LedgerLive and retry Zeus.`)
        const dpArg = await (async () => {
            const dp = await this.derivationPath.get();
            if (dp !== true && dp !== false) {
                return dp
            }
        })()

        const rpc = await this.rpcUrl.get();
        const provider = new JsonRpcProvider(rpc);

        const signer = await getLedgerSigner(provider, dpArg);
        return await signer.getAddress() as `0x${string}`;
    }

    async subclassForgeArgs(): Promise<string[]> {
        const derivationPathArgs = await (async () => {
            const dp = await this.derivationPath.get();
            if (dp !== true && dp !== false) {
                // if a derivation path is specified, use the `--mnemonic-derivation-paths` option.
                return [`--mnemonic-derivation-paths`, `${dp}`]
            } else {
                return [];
            }
        })()
        return ["--ledger", ...derivationPathArgs];
    }
}