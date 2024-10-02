import {Account, Chain, RpcSchema, Transport, WalletClient} from 'viem';
import { TUpgradeContext } from './base.js';

export class ForgeScriptUpgrade<
    TTransport extends Transport, 
    TNetwork extends Chain, 
    TAccount extends Account,
    TRPCSchema extends RpcSchema,
    TUCContext,
    TUCMeta
> {
    /**
     * [optional]
     * Purpose: emit transactions which would create new contracts pertinent to your protocol.
     * 
     * You may use `walletClient` freely -- any transactions sent will be queued for later and signed with the associated signing mechanism.
     */
    async create(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {
        
    }

    /**
     * [optional]
     * Purpose: queue any multisig changes which involve modifying existing contracts.
     */
    async queue(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {

    }

    /**
     * Execute the upgrade.
     *  - If you've queued an upgrade previously, this will be invoked only after the queue and its associated timelock
     *    are ready for execution.
     *  - If you had miscellaneous changes to make that didn't require a separate creation + timelock, you can do that here.
     */
    async execute(walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {

    }
}