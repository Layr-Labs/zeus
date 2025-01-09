import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { TDeploy } from "../../metadata/schema";
import { Strategy, TForgeRequest, TStrategyOptions } from "../../signing/strategy";
import { jest } from '@jest/globals';
import { TForgeOutput, TForgeRun } from "../../signing/utils";

const forgeSampleRun: TForgeRun = {
    timestamp: 0,
    chain: 1,
    transactions: [{
        hash: `0x0`,
        type: '0x123',
        contractName: 'Contract',
        contractAddress: '0x123',
        transaction: {from: '0xfrom'},
    }],
    logs: [],
    raw_logs: [],
    traces: [],
    gas_used: 1,
    labeled_addresses: {},
    returned: '0x123',
    address: '0x123'
};

const mockForgeOutput: TForgeRequest = {
    output: forgeSampleRun,
    stateUpdates: [], 
    forge: {
        runLatest: {},
        deployLatest: {}
    },
    signer: `0x123`,
    signedTransactions: [`0x12345`],
    deployedContracts: [],
    ready: true
};

export abstract class MockStrategy extends Strategy {
    id = "ledger";
    description = "mock";

    prepare = jest.fn<Strategy['prepare']>().mockResolvedValue(mockForgeOutput);
    requestNew = jest.fn<Strategy['requestNew']>().mockResolvedValue(mockForgeOutput);
    cancel = jest.fn<Strategy['cancel']>();

    // lets sub-scripts inject args.
    async forgeArgs(): Promise<string[]> {
        return [];
    }

    // lets sub-scripts inject args for a prepare / dry run.
    async forgeDryRunArgs(): Promise<string[]> {
        return [];
    }

    // any important data to redact in output.
    async redactInOutput(): Promise<string[]> {
        return [];
    }

    async runForgeScript(path: string, _args?: {isPrepare?: boolean, verbose?: boolean}): Promise<TForgeOutput> {
        return {
            stateUpdates: [],
            contractDeploys: [],
            output: {
                timestamp: 0,
                chain: 0, 
                success: true,
                returns: {
                    '0': {
                        value: ''
                    }
                },
                transactions: [],
                logs: [],
                raw_logs: [],
                traces: [],
                gas_used: 0,
                labeled_addresses: {},
                returned: null,
                address: null
            }
        }
    }

    constructor(deploy: SavebleDocument<TDeploy>, transaction: Transaction, options?: TStrategyOptions) {
        super(deploy, transaction, options);
    } 
}