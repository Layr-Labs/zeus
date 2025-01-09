import { LedgerSigner } from "@ethers-ext/signer-ledger";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { Provider } from "ethers";

const state: Record<string, LedgerSigner> = {}

export const getLedgerSigner = async (provider: Provider, derivationPath: string | undefined) => {
    const cacheKey = derivationPath === undefined ? 'default' : derivationPath;

    if (state[cacheKey]) {
        return state[cacheKey];
    }
    
    const transport = await TransportNodeHid.create(60_000);
    const signer = new LedgerSigner(transport, provider, derivationPath);
    state[cacheKey] = signer;
    return signer;
}