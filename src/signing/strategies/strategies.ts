import { MetadataStore } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy} from '../strategy';
import EOASigningStrategy from './eoa';
import { GnosisEOAStrategy } from './gnosisEoa';
import { LedgerSigningStrategy } from './ledger';

export const all: (new (deploy: TDeploy, options: Record<string, unknown>, metadataStore: MetadataStore) => Strategy<unknown>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAStrategy,
    //GnosisLedgerStrategy,
]