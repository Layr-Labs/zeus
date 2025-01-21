import { GnosisApiStrategy } from "./gnosisApi";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { checkShouldSignGnosisMessage, pressAnyButtonToContinue } from "../../../../commands/prompts";
import { createPublicClient, getContract, hashTypedData, http } from "viem";
import { ICachedArg, TStrategyOptions } from "../../../strategy";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import * as prompts from '../../../../commands/prompts';
import * as AllChains from 'viem/chains';
import { abi } from "../onchain/Safe";
import { getLedgerAccount } from "../../ledgerTransport";
 
export class GnosisLedgerStrategy extends GnosisApiStrategy {
    id = "gnosis.api.ledger";
    description = "Gnosis API - Ledger (Not For Private Hotfixes)";

    public bip32Path: ICachedArg<string> 

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.bip32Path = this.arg(async () => {
            return await prompts.bip32Path();
        }, 'bip32path')
    }

    async getSignature(version: string, txn: SafeTransaction, safeAddress: `0x${string}`): Promise<`0x${string}`> {
        const signer = await getLedgerAccount(await this.bip32Path.get());
        if (!signer.signTypedData) {
            throw new Error(`This ledger does not support signing typed data, and cannot be used with zeus.`);
        }

        const types = getEip712TxTypes(version);
        const typedDataParameters = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: safeAddress as `0x${string}`,
                chainId: this.deploy._.chainId,
            },
            primaryType: 'SafeTx',
            message: {
                ...txn.data,
                value: txn.data.value,
                safeTxGas: txn.data.safeTxGas,
                baseGas: txn.data.baseGas,
                gasPrice: txn.data.gasPrice,
                nonce: txn.data.nonce,
                refundReceiver: txn.data.refundReceiver,
            }
        };

        await checkShouldSignGnosisMessage(typedDataParameters);

        if (!signer.signMessage) {
            throw new Error(`This ledger doesn't support signing somehow.`);
        }

        const preImage = hashTypedData(typedDataParameters);
        console.log(`Signing from: ${signer.address}`);
        console.log(`Typed data hash to sign: ${preImage}`);

        try {
            console.log(`Signing with ledger(${signer.address}) (please check your device for instructions)...`);
            const signature = await signer.signTypedData(typedDataParameters);
            console.log(`Signature: ${signature}`);
            return signature;
        } catch (e) {
            if ((e as Error).message.includes(`0x6a80`)) {
                console.error(`Zeus requires that you enable blind signing on your device.`);
                console.error(`See: https://support.ledger.com/article/4405481324433-zd`);
                throw new Error(`This ledger does not support blind signing.`, {cause: e});
            }

            throw new Error(`An error occurred while accessing the Ledger`, {cause: e});
        }
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
                    
                    return signer.address;
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
}