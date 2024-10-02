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
    async create(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {
        // TODO: callout via forge cli.
        // TODO: submit transactions via `walletClient`.
    }

    async queue(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, _context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {
        // TODO: callout via forge cli.
        // TODO: submit transactions via `walletClient`.
    }

    async execute(_walletClient: WalletClient<TTransport, TNetwork, TAccount, TRPCSchema>, context: TUpgradeContext<TUCContext, TUCMeta>): Promise<void> {
        // TODO: callout via forge cli.
        // TODO: submit transactions via `walletClient`.
    }
}