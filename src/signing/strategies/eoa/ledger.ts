import { LedgerSigner } from "@ethers-ext/signer-ledger";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import EOABaseSigningStrategy from "./eoa";
import { getDefaultProvider } from "ethers";

type TLedgerArgs = object;
const provider = getDefaultProvider() // TODO:(multinetwork)

export class LedgerSigningStrategy extends EOABaseSigningStrategy<TLedgerArgs> {
    id = "ledger";
    description = "Signing w/ ledger";

    async getSignerAddress(): Promise<`0x${string}`> {
        const transport = await TransportNodeHid.create();
        const signer = new LedgerSigner(transport, provider);
        return await signer.getAddress() as `0x${string}`;
    }

    async promptSubArgs(): Promise<TLedgerArgs> {
        return {};
    }

    async subclassForgeArgs(): Promise<string[]> {
        return ["--ledger"];
    }
}