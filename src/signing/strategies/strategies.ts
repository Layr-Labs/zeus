import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy, TStrategyOptions} from '../strategy';
import EOASigningStrategy from './eoa/privateKey';
import { GnosisOnchainStrategy } from './gnosis/onchain/onchain';
import { GnosisEOAApiStrategy } from './gnosis/api/gnosisEoa';
import { GnosisLedgerStrategy } from './gnosis/api/gnosisLedger';
import { LedgerSigningStrategy } from './eoa/ledger';
import { WebGnosisSigningStrategy } from './gnosis/web/webStrategy';
import { GnosisOnchainLedgerStrategy } from './gnosis/onchain/onchainLedger';

export const all: (new (deploy: SavebleDocument<TDeploy>, metadata: Transaction, options?: TStrategyOptions) => Strategy)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAApiStrategy,
    GnosisLedgerStrategy,
    GnosisOnchainStrategy,
    GnosisOnchainLedgerStrategy,
    WebGnosisSigningStrategy
]