import { SavebleDocument, Transaction } from '../../metadata/metadataStore';
import { TDeploy } from '../../metadata/schema';
import {Strategy, TStrategyOptions} from '../strategy';
import EOASigningStrategy from './eoa/privateKey';
import { GnosisOnchainEoaStrategy } from './gnosis/onchain/onchainEoa';
import { GnosisOnchainLedgerStrategy } from './gnosis/onchain/onchainLedger';
import { GnosisEOAApiStrategy } from './gnosis/api/gnosisEoa';
import { GnosisLedgerStrategy } from './gnosis/api/gnosisLedger';
import { LedgerSigningStrategy } from './eoa/ledger';
import { WebGnosisSigningStrategy } from './gnosis/web/webStrategy';

export const all: (new (deploy: SavebleDocument<TDeploy>, metadata: Transaction, options?: TStrategyOptions) => Strategy)[] = [
    EOASigningStrategy,
    LedgerSigningStrategy,
    GnosisEOAApiStrategy,
    GnosisLedgerStrategy,
    GnosisOnchainEoaStrategy,
    GnosisOnchainLedgerStrategy,
    WebGnosisSigningStrategy
]