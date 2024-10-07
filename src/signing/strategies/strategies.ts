import {SigningStrategy} from '../signingStrategy.js';
import EOASigningStrategy from './eoa.js';
import { GnosisEOAStrategy } from './gnosisEoa.js';
import { GnosisLedgerStrategy } from './gnosisLedger.js';
import { LedgerSigningStrategy } from './ledger.js';

export const all: (new (options: Record<string, any>) => SigningStrategy<any>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAStrategy,
    GnosisLedgerStrategy,
]