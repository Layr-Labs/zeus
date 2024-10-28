import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy} from '../strategy';
import EOASigningStrategy from './eoa/privateKey';
import { GnosisEOAStrategy } from './gnosis/api/gnosisEoa';
//import { GnosisLedgerStrategy } from './gnosisLedger';
import { LedgerSigningStrategy } from './eoa/ledger';

export const all: (new (deploy: SavebleDocument<TDeploy>, metadata: Transaction) => Strategy<unknown>)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAStrategy,
    //GnosisLedgerStrategy,
]