import {abi} from './Safe';
import { ICachedArg, TSignatureRequest } from "../../../strategy";
import { GnosisSigningStrategy } from "../gnosis";
import { createWalletClient, encodePacked, getContract, http } from "viem";
import { SavebleDocument, Transaction } from "../../../../metadata/metadataStore";
import { TDeploy } from "../../../../metadata/schema";
import { privateKey } from "../../../../commands/prompts";
import { privateKeyToAccount } from "viem/accounts";
import * as AllChains from "viem/chains";
import { OperationType } from '@safe-global/types-kit';
import Safe from '@safe-global/protocol-kit'

export class GnosisOnchainStrategy extends GnosisSigningStrategy {
    id = 'gnosis.onchain';
    description = '[Testnet Only] SAFE Onchain Call via PrivateKey';

    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, defaultArgs?: Record<string, unknown>) {
        super(deploy, transaction, defaultArgs);
        this.privateKey = this.arg(async () => await privateKey(this.deploy._.chainId, 'Enter the private key of a signer for your SAFE'))
    } 

    // see: (https://github.com/safe-global/safe-smart-account/blob/main/contracts/Safe.sol#L313)
    approvalSignature(signer: `0x${string}`) {
        const paddedSigner = `0x${'0'.repeat(24)}${signer.slice(2)}` as `0x${string}`;
        return encodePacked(['bytes32', 'bytes32', 'bytes1'], [
            paddedSigner, /* r */
            ('0x' + '0'.repeat(64)) as `0x${string}`, /* s */
            `0x01` /* v - indicating that this is an approval */
        ])
    }

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const forge = await this.runForgeScript(pathToUpgrade);
        const {output, stateUpdates, safeContext} = forge;
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }

        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        
        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        console.log(`Multisig transaction to execute: `)
        console.table(safeTxn);

        const chain = Object.values(AllChains).find(value => value.id === this.deploy._.chainId);
        if (!chain) {
            throw new Error(`Unsupported chain ${this.deploy._.chainId}`);
        }

        const walletClient = createWalletClient({
            account: privateKeyToAccount(await this.privateKey.get()),
            transport: http(await this.rpcUrl.get()),
            chain
        })

        const signer = walletClient.account.address;
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: safeContext.addr
        });
        const safe = getContract({abi, client: walletClient, address: safeContext.addr})
        const txn = await protocolKitOwner1.createTransaction({
            transactions: [
                {
                    to: to,
                    data,
                    value,
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                }
            ],
        });

        const signatures = this.approvalSignature(signer);
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
        const simulation = await safe.simulate.execTransaction([
            txn.data.to as `0x${string}`,
            BigInt(txn.data.value),
            txn.data.data as `0x${string}`,
            txn.data.operation,
            BigInt(txn.data.safeTxGas),
            BigInt(txn.data.baseGas),
            BigInt(txn.data.gasPrice),
            txn.data.gasToken as `0x${string}`,
            txn.data.refundReceiver as `0x${string}`,
            signatures
        ], {});
       
        return {
            output,
            safeAddress: safeContext.addr,
            safeTxHash: txHash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates,
            immediateExecution: {
                transaction: undefined,
                success: simulation.result,
                simulation: simulation.request,
            }
        }
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const forge = await this.runForgeScript(pathToUpgrade);
        const {output, stateUpdates, safeContext} = forge;
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }

        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);

        const safeTxn = multisigExecuteRequests[0];
        const {to, value, data} = safeTxn;

        console.log(`Multisig transaction to execute: `)
        console.table(safeTxn);

        const chain = Object.values(AllChains).find(value => value.id === this.deploy._.chainId);
        if (!chain) {
            throw new Error(`Unsupported chain ${this.deploy._.chainId}`);
        }

        const walletClient = createWalletClient({
            account: privateKeyToAccount(await this.privateKey.get()),
            transport: http(await this.rpcUrl.get()),
            chain
        })

        const signer = walletClient.account.address;
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer,
            safeAddress: safeContext.addr
        });
        const safe = getContract({abi, client: walletClient, address: safeContext.addr})
        const txn = await protocolKitOwner1.createTransaction({
            transactions: [
                {
                    to: to,
                    data,
                    value,
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                }
            ],
        });

        const signatures = this.approvalSignature(signer);
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
            signatures
        ], {});
       
        return {
            output,
            safeAddress: safeContext.addr,
            safeTxHash: txHash as `0x${string}`,
            senderAddress: signer as `0x${string}`,
            stateUpdates,
            immediateExecution: {
                transaction: tx,
                success: true,
            }
        }
    }


    async cancel(_deploy: SavebleDocument<TDeploy>): Promise<void> {
        // TODO: I don't think we can cancel this. It either executed or didn't.
        throw new Error('uncancellable.');
    }
}