import { holesky } from "viem/chains"

export const overrideTxServiceUrlForChainId = (chainId: number) => {
    if (chainId == holesky.id || chainId == 560048) {
        return 'https://transaction-holesky.holesky-safe.protofire.io/api';
    }
}

export const multisigBaseUrl = (chainId: number) => {
    if (chainId == holesky.id || chainId == 560048) {
        return 'https://holesky-safe.protofire.io';
    } else {
        return 'https://app.safe.global';
    }
}