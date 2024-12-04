import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy} from '../strategy';
import EOASigningStrategy from './eoa/privateKey';
import { GnosisOnchainStrategy } from './gnosis/onchain/onchain';
import { GnosisEOAApiStrategy } from './gnosis/api/gnosisEoa';
import { GnosisLedgerStrategy } from './gnosis/api/gnosisLedger';
import { LedgerSigningStrategy } from './eoa/ledger';

export const all: (new (deploy: SavebleDocument<TDeploy>, metadata: Transaction) => Strategy)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAApiStrategy,
    GnosisLedgerStrategy,
    GnosisOnchainStrategy
]