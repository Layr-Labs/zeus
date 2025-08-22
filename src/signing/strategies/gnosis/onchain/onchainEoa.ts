import { ICachedArg, TStrategyOptions } from "../../../strategy";
import { GnosisOnchainBaseStrategy } from "./onchainBase";
import { createWalletClient, http, WalletClient } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import { privateKey, signerKey } from "../../../../commands/prompts";
import { privateKeyToAccount } from "viem/accounts";
import { Chain } from "viem/chains";

export class GnosisOnchainEOAStrategy extends GnosisOnchainBaseStrategy {
    id = 'gnosis.onchain.eoa';
    description = 'Onchain EOA - Safe.execTransaction() (for 1/N multisigs only)';

    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.privateKey = this.arg(async () => {
            if (!this.forMultisig) {
                return await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE')
            } else {
                return await signerKey(deploy._.chainId, await this.rpcUrl.get(), `Enter the private key of a signer for your SAFE(${this.forMultisig})`, this.forMultisig)
            }
        })
    } 

    async getSignerAddress(): Promise<`0x${string}`> {
        const pk = await this.privateKey.get();
        return privateKeyToAccount(pk).address as `0x${string}`;
    }

    async getWalletClient(chain: Chain): Promise<WalletClient> {
        return createWalletClient({
            account: privateKeyToAccount(await this.privateKey.get()),
            transport: http(await this.rpcUrl.get()),
            chain
        });
    }
}