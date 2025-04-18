import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { TDeploy, TSegmentType } from "../../../metadata/schema";
import {all} from '../../../signing/strategies/strategies'
import { TStrategyOptions } from "../../../signing/strategy";
import { pickStrategy } from "../../prompts";

export const supportedSigners: Record<TSegmentType, string[]> = {
    "eoa": ["eoa", "ledger"],
    "multisig": ["gnosis.api.eoa", "gnosis.api.ledger", "gnosis.api.web", "gnosis.onchain"],
    "script": [],
    "system": [],
}

export const promptForStrategy = async (deploy: SavebleDocument<TDeploy>, txn: Transaction, overridePrompt?: string) => {
    return promptForStrategyWithOptions(deploy, txn, overridePrompt, undefined);
}

export const promptForStrategyWithOptions = async (deploy: SavebleDocument<TDeploy>, txn: Transaction, overridePrompt?: string, options?: TStrategyOptions) => {
    const segment = deploy._.segments[deploy._.segmentId];
    const supportedStrategies = supportedSigners[segment.type]
        .filter(strategyId => {
            return !!all.find(s => new s(deploy, txn).id === strategyId);
        })
        .map(strategyId => {
            const strategyClass = all.find(s => new s(deploy, txn).id === strategyId);
            if (!strategyClass) {
                throw new Error('invalid branch.'); // for typechecker, since .filter() doesn't refine...
            }
            return new strategyClass(deploy, txn, options);
        });
    const strategyId = await pickStrategy(supportedStrategies, overridePrompt)      
    const strat = supportedStrategies.find(s => s.id === strategyId);
    if (!strat) {
        throw new Error(`Unknown strategy '${strategyId}'.`);
    }      
    return strat;
}