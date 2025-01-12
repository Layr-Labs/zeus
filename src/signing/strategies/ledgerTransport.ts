import {ledgerToAccount, BASE_DERIVATION_PATH} from './ledger/account'
import { Account } from "viem";

export const DEFAULT_BASE_DERIVATION_PATH = `m/44'/60'/0'/0`

const ledgerAccounts: Record<number, Account> = {};

export const getLedgerAccount = async (accountIndex = 0) => {
    if (ledgerAccounts[accountIndex] === undefined) {
        ledgerAccounts[accountIndex] = await ledgerToAccount({
            derivationPath: `${BASE_DERIVATION_PATH}/${accountIndex}`
        })
    }

    return ledgerAccounts[accountIndex];
}

