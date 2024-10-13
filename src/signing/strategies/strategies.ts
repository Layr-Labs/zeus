import { MetadataStore } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy} from '../strategy';
import EOASigningStrategy from './eoa';
import { GnosisEOAStrategy } from './gnosisEoa';
import { GnosisLedgerStrategy } from './gnosisLedger';
import { LedgerSigningStrategy } from './ledger';

export const all: (new (deploy: TDeploy, options: Record<string, any>, metadataStore: MetadataStore) => Strategy<any>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAStrategy,
    //GnosisLedgerStrategy,
]