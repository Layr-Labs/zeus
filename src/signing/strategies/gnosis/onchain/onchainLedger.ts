import { ICachedArg, TSignatureRequest, TStrategyOptions } from "../../../strategy";
import { GnosisOnchainStrategy } from "./onchain";
import { createPublicClient, createWalletClient, getAddress, getContract, hashTypedData, hexToBigInt, hexToNumber, http, parseEther } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import { getLedgerAccount } from "../../ledgerTransport";
import * as prompts from '../../../../commands/prompts';
import * as AllChains from "viem/chains";
import { checkShouldSignGnosisMessage } from "../../../../commands/prompts";
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index";
import Safe from '@safe-global/protocol-kit';
import { OperationType } from '@safe-global/types-kit';
import { abi } from "./Safe";

export class GnosisOnchainLedgerStrategy extends GnosisOnchainStrategy {
    id = 'gnosis.onchain.ledger';
    description = 'Onchain Safe.execTransaction() with Ledger (for 1/N multisigs only)';

    public bip32Path: ICachedArg<string>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
        this.bip32Path = this.arg(async () => {
            return await prompts.bip32Path();
        })
    }

    private async getLedgerWalletClient() {
        const signer = await getLedgerAccount(await this.bip32Path.get());
        
        if (!signer.signTypedData) {
            throw new Error(`This ledger does not support signing typed data, and cannot be used with zeus.`);
        }

        // Create a custom wallet client that uses ledger for signing but doesn't require a chain
        return {
            account: signer,
            signTypedData: signer.signTypedData.bind(signer),
            address: signer.address,
        };
    }

    private async signTransactionWithLedger(txn: any, safeAddress: `0x${string}`, version: string): Promise<`0x${string}`> {
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

    private async validateLedgerSigner(): Promise<`0x${string}`> {
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
                        await prompts.pressAnyButtonToContinue();
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

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const signer = await this.validateLedgerSigner();
        
        // Create a mock wallet client for the base class methods
        const mockWalletClient = {
            account: { address: signer },
        };

        return this.prepareOnchainTransaction(pathToUpgrade, signer, mockWalletClient as any);
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const signer = await this.validateLedgerSigner();
        
        // We need to modify the base class behavior for ledger signing
        const forge = await this.runForgeScript(pathToUpgrade);
        const {output, stateUpdates, safeContext, contractDeploys} = forge;
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }
        this.forMultisig = safeContext.addr;

        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        if (multisigExecuteRequests.length === 0) {
            console.warn(`This step returned no transactions. If this isn't intentional, consider cancelling your deploy.`);
            return {
                empty: true,
                safeAddress: safeContext.addr as `0x${string}`,
                safeTxHash: undefined,
                senderAddress: signer,
                stateUpdates,
                deployedContracts: contractDeploys.map((ct) => {
                    return {
                        address: ct.addr,
                        contract: ct.name,
                        singleton: ct.singleton
                    }
                })
            }
        }

        console.log(`(${multisigExecuteRequests.length}) Multisig transaction(s) to execute: `);
        console.log(JSON.stringify(multisigExecuteRequests, null, 2));

        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: safeContext.addr
        });

        const threshold = await protocolKitOwner1.getThreshold();
        if (threshold !== 1) {
            console.warn(`Warning -- this strategy may not work with non 1/N multisigs.`);
        }

        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map(({to, value, data}) => 
                ({
                    to: getAddress(to),
                    data,
                    value: hexToNumber(value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                })
            ),
        });

        console.log(`Transaction: `);
        console.log(JSON.stringify(txn, null, 2));

        const chain = Object.values(AllChains).find(value => value.id === this.deploy._.chainId);
        if (!chain) {
            throw new Error(`Unsupported chain ${this.deploy._.chainId}`);
        }

        if (this.options?.defaultArgs?.fork) {
            // Use the base class fork handling
            const testClient = this.options?.defaultArgs?.testClient;
            if (!testClient) {
                throw new Error(`Expected not-null.`);
            }

            await testClient.setBalance(safeContext.addr, parseEther('10000'))

            console.info(`Using sendUnsignedTransaction to simulate multisig call...`);
            const tx = await testClient.sendUnsignedTransaction({
                from: safeContext.addr,
                to: txn.data.to as `0x${string}`,
                value: hexToBigInt(txn.data.value as `0x${string}`),
                data: txn.data.data as `0x${string}`
            })

            const rpcUrl = await this.rpcUrl.get();
            const publicClient = createPublicClient({transport: http(rpcUrl)});
            const lastBlock = await publicClient.getBlock();

            const nextTimestamp = lastBlock.timestamp + (60n * 60n * 24n * 30n);
            console.info(`Current time: ${new Date(Number(lastBlock.timestamp * 1000n))}`)
            console.info(`Warping forward to: ${new Date(Number(nextTimestamp * 1000n))}`);
            await testClient.fastForward(
                lastBlock.timestamp + (60n * 60n * 24n * 30n)
            )

            return {
                empty: false,
                output,
                safeAddress: safeContext.addr,
                safeTxHash: tx as `0x${string}`,
                senderAddress: `0x0`,
                stateUpdates,
                deployedContracts: contractDeploys.map((ct) => {
                    return {
                        address: ct.addr,
                        contract: ct.name,
                        singleton: ct.singleton
                    }
                }),
                immediateExecution: {
                    transaction: tx,
                    success: true,
                }
            }
        }

        // For ledger, we need to sign the transaction instead of using approval signature
        const version = await protocolKitOwner1.getContractVersion();
        const signature = await this.signTransactionWithLedger(txn, safeContext.addr, version);
        
        // Create wallet client for transaction execution
        const walletClient = createWalletClient({
            account: await getLedgerAccount(await this.bip32Path.get()),
            transport: http(await this.rpcUrl.get()),
            chain
        });

        const safe = getContract({abi, client: walletClient, address: safeContext.addr})
        const nonce = await safe.read.nonce();
        const txHash = await safe.read.getTransactionHash([
            txn.data.to as `0x${string}`,
            BigInt(txn.data.value),
            txn.data.data as `0x${string}`,
            txn.data.operation,
            BigInt(txn.data.safeTxGas),
            BigInt(txn.data.baseGas),
            BigInt(txn.data.gasPrice),
            txn.data.gasToken as `0x${string}`,
            txn.data.refundReceiver as `0x${string}`,
            nonce + 1n,
        ]);

        const tx = await safe.write.execTransaction([
            txn.data.to as `0x${string}`,
            BigInt(txn.data.value),
            txn.data.data as `0x${string}`,
            txn.data.operation,
            BigInt(txn.data.safeTxGas),
            BigInt(txn.data.baseGas),
            BigInt(txn.data.gasPrice),
            txn.data.gasToken as `0x${string}`,
            txn.data.refundReceiver as `0x${string}`,
            signature
        ], {chain});

        return {
            empty: false,
            output,
            safeAddress: safeContext.addr,
            safeTxHash: txHash as `0x${string}`,
            senderAddress: signer,
            stateUpdates,
            deployedContracts: contractDeploys.map((ct) => {
                return {
                    address: ct.addr,
                    contract: ct.name,
                    singleton: ct.singleton
                }
            }),
            immediateExecution: {
                transaction: tx,
                success: true,
            }
        }
    }
}