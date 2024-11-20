import EOABaseSigningStrategy from "./eoa";
import { getLedgerSigner } from "../ledgerTransport";
import { JsonRpcProvider } from "ethers";

export class LedgerSigningStrategy extends EOABaseSigningStrategy {
    id = "ledger";
    description = "Signing w/ ledger";

    async getSignerAddress(): Promise<`0x${string}`> {
        console.warn(`If your ledger is not working, you may need to open LedgerLive, navigate to: Accounts -> <Signer> -> Receive and follow the prompts on device. Once your Ledger says "Application is Ready", you can force quit LedgerLive and retry Zeus.`)
        
        const rpc = await this.rpcUrl.get();
        const provider = new JsonRpcProvider(rpc);
        const signer = await getLedgerSigner(provider);
        return await signer.getAddress() as `0x${string}`;
    }

    async subclassForgeArgs(): Promise<string[]> {
        return ["--ledger"];
    }
}