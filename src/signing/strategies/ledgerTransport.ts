import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import {ledgerToAccount} from '@celo/viem-account-ledger'
import { Account } from "viem";

export const DEFAULT_BASE_DERIVATION_PATH = `m/44'/60'/0'/0`

let transport: TransportNodeHid | undefined;
const ledgerAccounts: Record<number, Account> = {};

export const getLedgerAccount = async (accountIndex = 0) => {
    if (transport === undefined) {
        transport = await TransportNodeHid.open('');
    }

    if (ledgerAccounts[accountIndex] === undefined) {
        ledgerAccounts[accountIndex] = await ledgerToAccount({
            transport,
            baseDerivationPath: DEFAULT_BASE_DERIVATION_PATH,
            derivationPathIndex: accountIndex
        })
    }

    return ledgerAccounts[accountIndex];
}

