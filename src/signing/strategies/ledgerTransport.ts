import {ledgerToAccount} from './ledger/account'
import { Account } from "viem";

export const DEFAULT_BASE_DERIVATION_PATH = `m/44'/60'/0'/0`

const ledgerAccounts: Record<string, Account> = {};

export const getLedgerAccount = async (derivationPath = DEFAULT_BASE_DERIVATION_PATH) => {
    if (ledgerAccounts[derivationPath] === undefined) {
        ledgerAccounts[derivationPath] = await ledgerToAccount({
            derivationPath: derivationPath.slice(2) as `44'/60'/0'/0${string}`
        })
    }

    return ledgerAccounts[derivationPath];
}

