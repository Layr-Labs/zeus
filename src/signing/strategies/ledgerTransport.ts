import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import { DEFAULT_DERIVATION_PATH, ledgerToAccount } from '@celo/viem-account-ledger'
import { Account } from "viem";

let transport: TransportNodeHid | undefined;
const ledgerAccounts: Record<number, Account> = {};

export const getLedgerAccount = async (accountIndex = 0) => {
    if (transport === undefined) {
        transport = await TransportNodeHid.open('');
    }

    if (ledgerAccounts[accountIndex] === undefined) {
        ledgerAccounts[accountIndex] = await ledgerToAccount({
            transport,
            baseDerivationPath: DEFAULT_DERIVATION_PATH,
            derivationPathIndex: accountIndex
        })
    }

    return ledgerAccounts[accountIndex];
}

