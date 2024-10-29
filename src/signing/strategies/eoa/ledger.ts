import EOABaseSigningStrategy from "./eoa";
import { getDefaultProvider } from "ethers";
import { getLedgerSigner } from "../ledgerTransport";

type TLedgerArgs = object;
const provider = getDefaultProvider() // TODO:(multinetwork)

export class LedgerSigningStrategy extends EOABaseSigningStrategy<TLedgerArgs> {
    id = "ledger";
    description = "Signing w/ ledger";

    async getSignerAddress(): Promise<`0x${string}`> {
        const signer = await getLedgerSigner(provider);
        return await signer.getAddress() as `0x${string}`;
    }

    async promptSubArgs(): Promise<TLedgerArgs> {
        console.warn(`If your ledger is not working, you may need to open LedgerLive, navigate to: Accounts -> <Signer> -> Receive and follow the prompts on device. Once your Ledger says "Application is Ready", you can force quit LedgerLive and retry Zeus.`)
        return {};
    }

    async subclassForgeArgs(): Promise<string[]> {
        return ["--ledger"];
    }
}