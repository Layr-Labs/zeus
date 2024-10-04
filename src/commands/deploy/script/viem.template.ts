import {Account, Chain, RpcSchema, Transport, WalletClient} from 'viem';
import { TUpgradeContext, Upgrade } from './base.js';

type _TEMPLATE_AUTO_POPULATE_ = number;

type _TEMPLATE_CONTEXT_TYPE = {
    _TEMPLATE_AUTO_POPULATE_CONTEXT_: _TEMPLATE_AUTO_POPULATE_ // TODO: templater will auto-fill this.
}

type _TEMPLATE_META_TYPE = {
    _TEMPLATE_AUTO_POPULATE_META_: _TEMPLATE_AUTO_POPULATE_ // TODO: templater will auto-fill this.
}

export class _TEMPLATE_NAME_Upgrade<
    TTransport extends Transport, 
    TNetwork extends Chain, 
    TAccount extends Account,
    TRPCSchema extends RpcSchema
> extends Upgrade<TTransport, TNetwork, TAccount, TRPCSchema, _TEMPLATE_CONTEXT_TYPE, _TEMPLATE_META_TYPE> {

    /**
     * [optional]
     * Purpose: emit transactions which would create new contracts pertinent to your protocol.
     * 
     * You may use `walletClient` freely -- any transactions sent will be queued for later and signed with the associated signing mechanism.
     */
    async create(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<_TEMPLATE_CONTEXT_TYPE, _TEMPLATE_META_TYPE>): Promise<void> {
        // TODO[optional]: use walletClient + context to create transactions. remove this method if unneeded.
    }

    /**
     * [optional]
     * Purpose: queue any multisig changes which involve modifying existing contracts.
     */
    async queue(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<_TEMPLATE_CONTEXT_TYPE, _TEMPLATE_META_TYPE>): Promise<void> {
        // TODO[optional]: use walletClient + context to create transactions. remove this method if unneeded.
    }

    /**
     * Execute the upgrade.
     *  - If you've queued an upgrade previously, this will be invoked only after the queue and its associated timelock
     *    are ready for execution.
     *  - If you had miscellaneous changes to make that didn't require a separate creation + timelock, you can do that here.
     */
    async execute(walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<_TEMPLATE_CONTEXT_TYPE, _TEMPLATE_META_TYPE>): Promise<void> {
        // TODO: use walletClient + context to create transactions.
    }
}