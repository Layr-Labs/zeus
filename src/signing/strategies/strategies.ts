import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy} from '../strategy';
import EOASigningStrategy from './eoa';
import { GnosisEOAStrategy } from './gnosisEoa';
//import { GnosisLedgerStrategy } from './gnosisLedger';
import { LedgerSigningStrategy } from './ledger';

export const all: (new (deploy: SavebleDocument<TDeploy>, metadata: Transaction) => Strategy<unknown>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAStrategy,
    //GnosisLedgerStrategy,
]