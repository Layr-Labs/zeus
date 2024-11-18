import { privateKeyToAccount } from 'viem/accounts';
import * as prompts from '../../../commands/prompts';
import EOABaseSigningStrategy from "./eoa";

interface TEOAArgs {
    privateKey: string
}

export default class EOASigningStrategy extends EOABaseSigningStrategy<TEOAArgs> {
    id = "eoa";
    description = "Signing w/ private key";

    async promptSubArgs(): Promise<TEOAArgs> {
        const pk = await prompts.privateKey(this.deploy._.chainId);
        return {privateKey: pk};
    }
    
    async subclassForgeArgs(): Promise<string[]> {
        const args = await this.args();
        return ["--private-key", args.privateKey]
    }

    usage(): string {
        return '--privateKey [0x123123123] --rpcUrl <execution node>';
    }

    async redactInOutput(): Promise<string[]> {
        const args = await this.args();
        return [args.privateKey, ...await super.redactInOutput()];
    }

    async getSignerAddress(): Promise<`0x${string}`> {
        const args = await this.args();
        return privateKeyToAccount(args.privateKey as `0x${string}`).address;
    }
}