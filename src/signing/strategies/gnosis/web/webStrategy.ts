/* eslint-disable */
import { GnosisSigningStrategy } from "../gnosis";
import { SavebleDocument } from "../../../../metadata/metadataStore";
import { MultisigMetadata, TDeploy, TMultisigPhase } from "../../../../metadata/schema";
import { TSignatureRequest, TSignedGnosisRequest } from "../../../strategy";
import Safe from '@safe-global/protocol-kit'
import { OperationType, SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { getAddress, hexToNumber, verifyTypedData } from "viem";
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import chalk from "chalk";
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import open from 'open';
import { overrideTxServiceUrlForChainId } from "../api/utils";
import { Request, Response } from "express";
import SafeApiKit from "@safe-global/api-kit";

// For generating a random port between 3000 and 65535
function getRandomPort() {
    return Math.floor(Math.random() * (65535 - 3000 + 1)) + 3000;
}

type TWebModalSignature = {
    signature: `0x${string}`;
    sender: `0x${string}`;
}

// For generating a secure random token
function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

interface SignatureData {
    signature: string;
    secret: string;
    address: string;
}

export class WebGnosisSigningStrategy extends GnosisSigningStrategy {
    id = 'gnosis.api.web';
    description = 'Gnosis API - Web Interface (Metamask, Ledger, GridPlus)';
    private server: ReturnType<typeof createServer> | null = null;
    private resolveSignaturePromise: ((result: TWebModalSignature) => void) | null = null;

    async prepare(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const { output, stateUpdates, safeContext } = await this.runForgeScript(pathToUpgrade);
        
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }
        
        this.forMultisig = safeContext.addr;
        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        
        if (multisigExecuteRequests.length === 0) {
            console.warn(`This step returned no transactions. If this isn't intentional, consider cancelling your deploy.`);
            return {
                empty: true,
                safeAddress: getAddress(safeContext.addr) as `0x${string}`,
                safeTxHash: undefined,
                senderAddress: undefined,
                stateUpdates
            };
        }

        // Just performing a dry-run for prepare
        console.log(chalk.italic(`Upgrade script produced the following transactions: `));
        console.table(JSON.stringify(multisigExecuteRequests, null, 2));

        return {
            empty: false,
            output,
            safeAddress: getAddress(safeContext.addr) as `0x${string}`,
            safeTxHash: undefined,
            senderAddress: undefined,
            stateUpdates
        };
    }

    async requestNew(pathToUpgrade: string): Promise<TSignatureRequest | undefined> {
        const { output, stateUpdates, safeContext } = await this.runForgeScript(pathToUpgrade);
        
        if (!safeContext) {
            throw new Error(`Invalid script -- this was not a multisig script.`);
        }
        
        this.forMultisig = safeContext.addr;
        const multisigExecuteRequests = this.filterMultisigRequests(output, safeContext.addr);
        
        if (multisigExecuteRequests.length === 0) {
            console.warn(`This step returned no transactions. If this isn't intentional, consider cancelling your deploy.`);
            return {
                empty: true,
                safeAddress: getAddress(safeContext.addr) as `0x${string}`,
                safeTxHash: undefined,
                senderAddress: undefined,
                stateUpdates
            };
        }

        console.log(`Multisig transaction to execute: `);
        console.table(JSON.stringify(multisigExecuteRequests, null, 2));

        // propose this transaction to SAFE.
        const protocolKitOwner1 = await Safe.init({
            provider: await this.rpcUrl.get(),
            signer: undefined,
            safeAddress: getAddress(safeContext.addr)
        });
        
        const txn = await protocolKitOwner1.createTransaction({
            transactions: multisigExecuteRequests.map(({to, value, data}) => 
                ({
                    to: getAddress(to),
                    data,
                    value: hexToNumber(value as `0x${string}`).toString(),
                    operation: safeContext.callType === 0 ? OperationType.Call : OperationType.DelegateCall
                })
            ),
        })
        const version = await protocolKitOwner1.getContractVersion();
        
        const {signature, sender} = await this.requestSignature(txn, protocolKitOwner1, safeContext.addr);
        
        if (stateUpdates) {
            console.log(chalk.bold.underline(`Updated Environment: `));
            console.table(stateUpdates.map(mut => {return {name: mut.name, value: mut.value}}));
        }
        
        console.log(`Creating transaction...`);
        const hash = await protocolKitOwner1.getTransactionHash(txn)
        
        const apiKit = new SafeApiKit({
            chainId: BigInt(this.deploy._.chainId),
            txServiceUrl: overrideTxServiceUrlForChainId(this.deploy._.chainId),
        })

        await apiKit.proposeTransaction({
            safeAddress: getAddress(safeContext.addr),
            safeTransactionData: txn.data,
            safeTxHash: hash,
            senderAddress: getAddress(sender),
            senderSignature: signature,
        })

        return {
            empty: false,
            output,
            safeAddress: getAddress(safeContext.addr) as `0x${string}`,
            safeTxHash: hash as `0x${string}`,
            senderAddress: signature.split(":")[0] as `0x${string}`,
            signature: signature.split(":")[1] as `0x${string}`,
            stateUpdates
        } as TSignedGnosisRequest;
    }

    private async requestSignature(txn: SafeTransaction, protocolKitOwner1: Safe, safeAddress: string): Promise<TWebModalSignature> {
        // Create the EIP-712 typed data object for signing using Gnosis Safe format
        // This matches the format used by getEip712TxTypes in @safe-global/protocol-kit
        const version = await protocolKitOwner1.getContractVersion();
        const types = getEip712TxTypes(version);
        const typedData = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: safeAddress,
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
       
        return new Promise<TWebModalSignature>((resolve) => {
            const port = getRandomPort();
            const secret = generateSecret();
            this.resolveSignaturePromise = resolve;

            const app = express();
            
            // Get the directory where the site is built
            // In production this will be included with the package
            let sitePath;
            try {
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                
                // First try the package installation path
                sitePath = path.resolve(__dirname, '../../../../../site/dist');
                
                // If that doesn't exist, try the relative path from the project root
                if (!fs.existsSync(sitePath)) {
                    sitePath = path.resolve(process.cwd(), 'site/dist');
                }
                
                // If that doesn't exist either, log verbose error to help with debugging
                if (!fs.existsSync(sitePath)) {
                    console.error(`Could not find site/dist directory at ${sitePath}`);
                    console.error(`Current directory: ${process.cwd()}`);
                    console.error(`__dirname: ${__dirname}`);
                    throw new Error('Failed to locate web signing interface files');
                }
                
                console.log(`Using web signing interface files from: ${sitePath}`);
            } catch (e) {
                console.error('Error resolving site path:', e);
                throw new Error('Failed to locate web signing interface files');
            }
            
            // Serve static files from the React app
            app.use(express.static(sitePath));
            app.use(express.json());
            
            // We're now checking Safe owners directly from the frontend
            
            // Endpoint for receiving the signature
            // @ts-expect-error express-typing is weird
            app.post('/api/sign', async (req: Request, res: Response) => {
                const data = req.body as SignatureData;
                
                // Validate the secret
                if (data.secret !== secret) {
                    return res.status(401).json({ error: 'Invalid secret' });
                }
                
                // Validate the signature format
                if (!data.signature || !data.signature.startsWith('0x')) {
                    return res.status(400).json({ error: 'Invalid signature format' });
                }
                
                // Validate that the address was provided
                if (!data.address || !data.address.startsWith('0x')) {
                    return res.status(400).json({ error: 'Invalid address format' });
                }
                
                try {
                    // Verify the signature using viem's verifyTypedData
                    const isValid = await verifyTypedData({
                        address: data.address as `0x${string}`,
                        // @ts-expect-error verification of typed data is weird in typescript
                        domain: typedData.domain,
                        // @ts-expect-error verification of typed data is weird in typescript
                        types: typedData.types,
                        // @ts-expect-error verification of typed data is weird in typescript
                        primaryType: typedData.primaryType,
                        // @ts-expect-error verification of typed data is weird in typescript
                        message: typedData.message,
                        signature: data.signature as `0x${string}`,
                    });
                    
                    if (!isValid) {
                        console.error(chalk.red('Signature verification failed!'));
                        return res.status(400).json({ error: 'Signature verification failed' });
                    }
                    
                    // Verify that the address is an owner of the Safe
                    try {
                        // TypeScript fix: explicitly check for domain object with verifyingContract 
                        const domain = typedData.domain as Record<string, unknown> | undefined;
                        const safeAddress = domain?.verifyingContract as string;
                        
                        if (safeAddress) {
                            const safeSDK = await Safe.init({
                                provider: await this.rpcUrl.get(),
                                signer: undefined,
                                safeAddress: getAddress(safeAddress)
                            });
                            
                            const owners = await safeSDK.getOwners();
                            const isOwner = owners.some(
                                owner => owner.toLowerCase() === data.address.toLowerCase()
                            );
                            
                            if (!isOwner) {
                                console.error(chalk.red(`Address ${data.address} is not an owner of Safe ${safeAddress}`));
                                return res.status(401).json({ 
                                    error: 'Not authorized to sign for this Safe',
                                    details: 'The connected wallet is not an owner of this Safe'
                                });
                            }
                            
                            console.log(chalk.green(`Address ${data.address} is an owner of Safe ${safeAddress}`));
                        }
                    } catch (err) {
                        console.warn(chalk.yellow(`Could not verify if address is an owner: ${err instanceof Error ? err.message : err}`));
                        // Continue anyway since we couldn't verify
                    }
                    
                    console.log(chalk.green(`Signature verified successfully for address ${data.address}`));
                    
                    // Close the server after receiving the signature
                    if (this.resolveSignaturePromise) {
                        this.resolveSignaturePromise({
                            signature: data.signature as `0x${string}`,
                            sender: data.address as `0x${string}`
                        });
                        this.resolveSignaturePromise = null;
                    }
                    
                    // Close the server
                    this.server?.close();
                    this.server = null;
                    
                    return res.json({ success: true });
                } catch (error) {
                    console.error(chalk.red('Error verifying signature:'), error);
                    return res.status(500).json({ 
                        error: 'Failed to verify signature',
                        details: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
            
            // Send all other requests to the React app
            app.get('*', (req: express.Request, res: express.Response) => {
                res.sendFile(path.join(sitePath, 'index.html'));
            });
            
            this.server = app.listen(port, () => {
                // Encode the EIP-712 typedData object for the URL
                const encodedTypedData = encodeURIComponent(JSON.stringify(typedData));
                
                // Create the URL with the encoded typedData and secret
                const url = `http://localhost:${port}?typedData=${encodedTypedData}&secret=${secret}`;
                
                console.log(`Web signing interface started at ${chalk.blue(url)}`);
                console.log(`Opening browser to complete signing...`);
                
                // Open the browser with the URL
                open(url).catch(() => {
                    console.log(chalk.yellow(`Failed to open browser automatically. Please open this URL manually: ${url}`));
                });
            });
        });
    }

    async cancel(deploy: SavebleDocument<TDeploy>): Promise<void> {
        switch (deploy._.phase as TMultisigPhase) {
            case "multisig_start":
            case "multisig_wait_signers":
            case "multisig_execute": {
                const metadata = deploy._.metadata[deploy._.segmentId] as MultisigMetadata;
                if (!metadata || Object.keys(metadata).length === 0) {
                    return;
                }
                const signer = metadata.signer;
                const rpcUrl = await this.rpcUrl.get();
                const protocolKitOwner = await Safe.init({
                    provider: rpcUrl,
                    safeAddress: metadata.multisig
                });

                const apiKit = new SafeApiKit({
                    chainId: BigInt(deploy._.chainId),
                    txServiceUrl: overrideTxServiceUrlForChainId(deploy._.chainId), // TODO: we probably want the option to inject a custom tx service url here...
                })
                const tx = await apiKit.getTransaction(metadata.gnosisTransactionHash);
                if (tx.isExecuted) {
                    throw new Error(`Cannot cancel, transaction ${tx.transactionHash} already executed.`);
                }

                const rejectionTxn = await protocolKitOwner.createRejectionTransaction(tx.nonce);
                const hash = await protocolKitOwner.getTransactionHash(rejectionTxn) as `0x${string}`;
                const sig = await this.requestSignature(rejectionTxn, protocolKitOwner, metadata.multisig)

                await apiKit.proposeTransaction({
                    safeAddress: metadata.multisig,
                    safeTransactionData: rejectionTxn.data,
                    safeTxHash: hash,
                    senderAddress: sig.sender,
                    senderSignature: sig.signature,
                })
                return;
            }

            case "multisig_wait_confirm":
                throw new Error('Transaction is already being processed and cannot be cancelled.');
            default:
                break;
        }

        throw new Error('Unable to cancel.');
    }
}