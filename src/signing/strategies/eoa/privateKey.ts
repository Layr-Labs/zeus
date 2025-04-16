import { privateKeyToAccount } from 'viem/accounts';
import * as prompts from '../../../commands/prompts';
import EOABaseSigningStrategy from "./eoa";
import { ICachedArg, TStrategyOptions } from '../../strategy';
import { SavebleDocument, Transaction } from '../../../metadata/metadataStore';
import { TDeploy } from '../../../metadata/schema';


export default class EOASigningStrategy extends EOABaseSigningStrategy {
    id = "eoa";
    description = "Signing w/ private key";
    privateKey: ICachedArg<`0x${string}`>

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options: TStrategyOptions | undefined) {
        super(deploy, transaction, options);
        this.privateKey = this.arg(async () => {
            return await prompts.privateKey(this.deploy._.chainId);
        }, "overrideEoaPk");
    } 

    async subclassForgeArgs(): Promise<string[]> {
        if (this.options?.simulationAddress !== undefined) {
            return [`--sender`, this.options.simulationAddress];
        }

        return ["--private-key", await this.privateKey.get()]
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async redactInOutput(): Promise<string[]> {
        const redact = [];
        try {
            redact.push(await this.privateKey.getImmediately());
        } catch {
            //
        }
        return [...redact, ...await super.redactInOutput()];
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        if (this.options?.simulationAddress !== undefined) {
            return this.options.simulationAddress as `0x${string}`;
        }

        const privateKey = await this.privateKey.get();
        return privateKeyToAccount(privateKey as `0x${string}`).address as `0x${string}`;
    }
}