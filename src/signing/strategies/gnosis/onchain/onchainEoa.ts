import { ICachedArg, TSignatureRequest, TStrategyOptions } from "../../../strategy";
import { GnosisOnchainStrategy } from "./onchain";
import { createWalletClient, http } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import { privateKey, signerKey } from "../../../../commands/prompts";
import { privateKeyToAccount } from "viem/accounts";
import * as AllChains from "viem/chains";

export class GnosisOnchainEoaStrategy extends GnosisOnchainStrategy {
    id = 'gnosis.onchain.eoa';
    description = 'Onchain Safe.execTransaction() with EOA (for 1/N multisigs only)';

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

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const chain = Object.values(AllChains).find(value => value.id === this.deploy._.chainId);
        if (!chain) {
            throw new Error(`Unsupported chain ${this.deploy._.chainId}`);
        }
        const walletClient = createWalletClient({
            account: privateKeyToAccount(await this.privateKey.get()),
            transport: http(await this.rpcUrl.get()),
            chain
        })

        const signer = walletClient.account.address as `0x${string}`;
        return this.prepareOnchainTransaction(pathToUpgrade, signer, walletClient);
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const walletClient = createWalletClient({
            account: privateKeyToAccount(await this.privateKey.get()),
            transport: http(await this.rpcUrl.get()),
        })

        const signer = walletClient.account.address as `0x${string}`;
        return this.executeOnchainTransaction(pathToUpgrade, signer, walletClient);
    }
}