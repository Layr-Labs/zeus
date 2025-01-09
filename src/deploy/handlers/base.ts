
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { TDeploy } from "../../metadata/schema";
import { TStrategyOptions } from "../../signing/strategy";

export interface PhaseTypeHandler {
    // attempt to push forward the deploy
    execute(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, options: TStrategyOptions | undefined): Promise<void>

    // attempt to cancel the deploy
    //
    // if undefined is specified, default (automatic) cancellation behavior will be used.
    cancel: undefined | ((deploy: SavebleDocument<TDeploy>, metatxn: Transaction, options: TStrategyOptions | undefined) => Promise<void>)
}