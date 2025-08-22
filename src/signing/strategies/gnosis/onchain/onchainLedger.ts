import { ICachedArg, TStrategyOptions } from "../../../strategy";
import { GnosisOnchainBaseStrategy } from "./onchainBase";
import { createPublicClient, createWalletClient, getContract, http, WalletClient } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import * as AllChains from "viem/chains";
import { Chain } from "viem/chains";
import * as prompts from '../../../../commands/prompts';
import { getLedgerAccount } from "../../ledgerTransport";
import { pressAnyButtonToContinue } from "../../../../commands/prompts";
import { abi } from './Safe';

export class GnosisOnchainLedgerStrategy extends GnosisOnchainBaseStrategy {
    id = 'gnosis.onchain.ledger';
    description = 'Onchain Ledger - Safe.execTransaction() (for 1/N multisigs only)';
    
    public bip32Path: ICachedArg<string> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.bip32Path = this.arg(async () => {
            return await prompts.bip32Path();
        })
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        console.log(`Querying ledger for address (check device for instructions)...`);

        try {
            while (true) {
                try {
                    const accountIndex = await this.bip32Path.get();
                    const signer = await getLedgerAccount(accountIndex);
                    console.log(`Detected ledger address: ${signer.address}`);    

                    // double check that this ledger is a signer for the multisig.
                    if (this.forMultisig) {
                        const client = createPublicClient({
                            transport: http(await this.rpcUrl.get()),
                            chain: Object.values(AllChains).find(chain => chain.id === this.deploy._.chainId),
                        })
                        const safe = getContract({
                            client,
                            abi,
                            address: this.forMultisig
                        })
                        if (!await safe.read.isOwner([signer.address])) {
                            throw new Error(`This ledger path (accountIndex=${accountIndex}) produced address (${signer.address}), which is not a signer on the multisig (${this.forMultisig})`);
                        }
                    }
                    
                    return signer.address as `0x${string}`;
                } catch (e) {
                    if ((e as Error).message.includes('Locked device')) {
                        console.error(`Error: Please unlock your ledger.`);
                        await pressAnyButtonToContinue();
                        continue;
                    } else {
                        console.warn(`An unknown ledger error occurred.`);
                    }
                    throw e;
                }
            }
        } catch (e) {
            throw new Error(`An error occurred while accessing the Ledger`, {cause: e});
        }
    }

    async getWalletClient(chain: Chain): Promise<WalletClient> {
        const accountIndex = await this.bip32Path.get();
        const ledgerAccount = await getLedgerAccount(accountIndex);
        
        return createWalletClient({
            account: ledgerAccount,
            transport: http(await this.rpcUrl.get()),
            chain
        });
    }
}