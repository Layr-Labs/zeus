import { GnosisApiStrategy } from "./gnosisApi";
import { SafeTransaction } from '@safe-global/types-kit';
import { getEip712TxTypes } from "@safe-global/protocol-kit/dist/src/utils/eip-712/index"
import { getDefaultProvider } from 'ethers'
import ora from "ora";
import chalk from "chalk";
import { checkShouldSignGnosisMessage, pressAnyButtonToContinue } from "../../../../commands/prompts";
import { getLedgerSigner } from "../../ledgerTransport";
import { TypedDataField } from "ethers";
import { verifyTypedData } from "viem";
 
export class GnosisLedgerStrategy extends GnosisApiStrategy {
    id = "gnosis.api.ledger";
    description = "[Not Private] Gnosis SAFE - signing w/ ledger using Gnosis API";
    
    async getSignature(version: string, txn: SafeTransaction): Promise<`0x${string}`> {
        const provider = getDefaultProvider();
        const signer = await getLedgerSigner(provider);
        const types = getEip712TxTypes(version);

        const typedDataArgs = {
            types: types as unknown as Record<string, unknown>,
            domain: {
                verifyingContract: await this.safeAddress.get() as `0x${string}`,
                chainId: this.deploy._.chainId,
            },
            primaryType: 'SafeTx',
            message: {
                ...txn.data,
                value: txn.data.value,
                safeTxGas: txn.data.safeTxGas,
                baseGas: txn.data.baseGas,
                gasPrice: txn.data.gasPrice,
                nonce: txn.data.nonce
            }
        };

        await checkShouldSignGnosisMessage(typedDataArgs);

        const prompt = ora(`Signing with ledger (please check your device for instructions)...`);
        const spinner = prompt.start();

        try {
            const addr = await signer.getAddress() as `0x${string}`;
            const signature = await signer.signTypedData(
                typedDataArgs.domain,
                {SafeTx: typedDataArgs.types.SafeTx} as unknown as Record<string, TypedDataField[]>, // lmao
                typedDataArgs.message
            ) as `0x${string}`

            const verification = await verifyTypedData({
                ...typedDataArgs, 
                address: addr, 
                signature
            })

            if (!verification) {
                console.error(`Failed to verify signature. Nothing will be submitted.`);
                throw new Error(`Invalid signature.`);
            }

            spinner.stopAndPersist({symbol: chalk.green('✔')});
            return signature;
        } catch (e) {
            spinner.stopAndPersist({symbol: '❌'});
            if ((e as Error).message.includes(`0x6a80`)) {
                console.error(`Zeus requires that you enable blind signing on your device.`);
                console.error(`See: https://support.ledger.com/article/4405481324433-zd`);
                throw new Error(`This ledger does not support blind signing.`, {cause: e});
            }

            throw new Error(`An error occurred while accessing the Ledger`, {cause: e});
        }
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        const prompt = ora(`Querying ledger for address...`);
        const spinner = prompt.start();

        try {
            while (true) {
                try {
                    const provider = getDefaultProvider() // TODO(multinetwork)
                    const signer = await getLedgerSigner(provider);
                    const res = await signer.getAddress() as `0x${string}`;
                    spinner.stopAndPersist({symbol: chalk.green('✔'), suffixText: res});
                    return res;
                } catch (e) {
                    if ((e as Error).message.includes('Locked device')) {
                        spinner.stopAndPersist({symbol: '❌'});
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
            spinner.stopAndPersist({symbol: '❌'});
            throw new Error(`An error occurred while accessing the Ledger`, {cause: e});
        }
    }
}