import chalk from 'chalk';
import { ledgerToAccount } from './ledger/account'
import { Account } from "viem";
import { pressAnyButtonToContinue } from '../../commands/prompts';

export const DEFAULT_BASE_DERIVATION_PATH = `m/44'/60'/0'/0`

const ledgerAccounts: Record<string, Account> = {};
const MAX_ATTEMPTS = 5;
const UNKNOWN_ERROR = `0x650e`;

export const getLedgerAccount = async (derivationPath = DEFAULT_BASE_DERIVATION_PATH) => {
    if (ledgerAccounts[derivationPath] === undefined) {
        let attempt = 0;
        while (attempt++ < MAX_ATTEMPTS) {
            try {
                ledgerAccounts[derivationPath] = await ledgerToAccount({
                    derivationPath: derivationPath.slice(2) as `44'/60'/0'/0${string}`
                })
            } catch (e: unknown) {
                if (e instanceof Error && e.message.includes(UNKNOWN_ERROR)) {
                    console.error(`ledger gave: UNKNOWN ERROR.`);
                    console.error(`full text: `, e)
                    console.error(chalk.bold(`Make sure your ledger app is open, and try again.`))
                    await pressAnyButtonToContinue();
                    continue;
                }
            }
        } 
    }

    return ledgerAccounts[derivationPath];
}