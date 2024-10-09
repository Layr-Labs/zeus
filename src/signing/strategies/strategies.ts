import { TDeploy } from '../../commands/deploy/cmd/utils.js';
import { MetadataStore } from '../../metadata/metadataStore.js';
import {Strategy} from '../strategy.js';
import EOASigningStrategy from './eoa.js';
import { GnosisEOAStrategy } from './gnosisEoa.js';
import { GnosisLedgerStrategy } from './gnosisLedger.js';
import { LedgerSigningStrategy } from './ledger.js';

export const all: (new (deploy: TDeploy, options: Record<string, any>, metadataStore: MetadataStore) => Strategy<any>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    // GnosisEOAStrategy,
    // GnosisLedgerStrategy,
]