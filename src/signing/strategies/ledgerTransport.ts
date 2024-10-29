import { LedgerSigner } from "@ethers-ext/signer-ledger";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { Provider } from "ethers";

const state: {signer: LedgerSigner | undefined} = {
    signer: undefined
}

export const getLedgerSigner = async (provider: Provider) => {
    if (state.signer) {
        return state.signer;
    }
    
    const transport = await TransportNodeHid.create(60_000);
    const signer = new LedgerSigner(transport, provider);
    state.signer = signer;
    return signer;
}