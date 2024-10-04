import { privateKeyToAccount } from "viem/accounts";
import { GnosisSigningStrategy } from "./gnosis.js";
import {SafeTransaction} from "@safe-global/safe-core-sdk-types";

type TGnosisEOAArgs = {
    privateKey: string;
}

export class GnosisEOAStrategy extends GnosisSigningStrategy<TGnosisEOAArgs> {
    id: string = "gnosis.eoa";
    
    isValidSubCommandArgs(obj: any): obj is TGnosisEOAArgs {
        return obj !== null && obj !== undefined && typeof obj.privateKey == 'string' && super.isValidArgs(obj); 
    }

    execute() {
        
    }

    forgeArgs(): string[] {
        return [];
    }
    
    async getTransactionHash(txn: SafeTransaction): Promise<`0x${string}`> {
        // const txnHash = await protocolKitOwner1.getTransactionHash(txn);      
        return `0x0`;
    }

    async getSignature(txn: SafeTransaction): Promise<`0x${string}`> {


        // const signature = await protocolKitOwner1.signHash(txnHash);
        return `0x0`;
    }

    async getSignerAddress(): Promise<string> {
        return privateKeyToAccount(this.args.privateKey! as `0x${string}`).address;
    }
}